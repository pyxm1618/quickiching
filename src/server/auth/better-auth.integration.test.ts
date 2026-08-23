import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { authTables, sessions, users, verifications } from "@/server/db/auth-schema";
import { buildAuthOptions } from "./server";
import { createMagicLinkEmailTransport } from "./email";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for Better Auth integration tests");

const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql, { schema: authTables });
const sentLinks: Array<{ email: string; url: string; token: string }> = [];
const auth = betterAuth(buildAuthOptions(db, {
  NODE_ENV: "test",
  BETTER_AUTH_URL: "https://www.quickiching.com",
  BETTER_AUTH_SECRET: "test-secret-for-integration-only-32-character-minimum",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM: "Quick I Ching <noreply@example.com>",
}, {
  sendMagicLink: async (data) => {
    sentLinks.push({ email: data.email, url: data.url, token: data.token });
  },
}));

const externalProviderRequests: string[] = [];
const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
  externalProviderRequests.push(String(input));
  throw new Error("EXTERNAL_PROVIDER_HTTP_DISABLED_FOR_TEST");
});

function authRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("origin", "https://www.quickiching.com");
  return new Request(`https://www.quickiching.com/api/auth${path}`, { ...init, headers });
}

async function jsonResponse(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("Better Auth 1.7.1 PostgreSQL integration", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    fetchSpy.mockRestore();
    await sql.end({ timeout: 5 });
  });

  it("creates hashed single-use Magic Link verification and a database session", async () => {
    sentLinks.length = 0;
    const requestedAt = Date.now();
    const start = await auth.handler(authRequest("/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "magic.integration@example.com", callbackURL: "/signin" }),
    }));

    expect(start.status).toBe(200);
    expect(sentLinks).toHaveLength(1);
    const link = sentLinks[0];
    expect(link.url).toContain("token=");

    const verificationRows = await db.select().from(verifications);
    expect(verificationRows).toHaveLength(1);
    expect(verificationRows[0]?.value).not.toBe(link.token);
    expect(JSON.stringify(verificationRows)).not.toContain(link.token);
    expect(verificationRows[0]?.value).toContain("magic.integration@example.com");
    expect(verificationRows[0]?.expiresAt.getTime()).toBeGreaterThanOrEqual(requestedAt + 599_000);
    expect(verificationRows[0]?.expiresAt.getTime()).toBeLessThanOrEqual(requestedAt + 601_000);

    const verified = await auth.handler(new Request(link.url, {
      headers: { origin: "https://www.quickiching.com" },
    }));
    expect([200, 302, 303]).toContain(verified.status);

    const setCookie = verified.headers.get("set-cookie") ?? "";
    const sessionCookie = setCookie.match(/(?:__Secure-)?better-auth\.session_token=[^;]+/)?.[0];
    expect(sessionCookie).toBeDefined();
    const currentSession = await auth.handler(authRequest("/get-session", {
      headers: { cookie: sessionCookie! },
    }));
    expect(currentSession.status).toBe(200);
    expect(await currentSession.json()).toMatchObject({
      user: { email: "magic.integration@example.com" },
    });

    const createdUsers = await db.select().from(users).where(eq(users.email, "magic.integration@example.com"));
    expect(createdUsers).toHaveLength(1);
    const sessionsBeforeSignOut = await db.select().from(sessions).where(eq(sessions.userId, createdUsers[0]!.id));
    expect(sessionsBeforeSignOut).toHaveLength(1);

    const signedOut = await auth.handler(authRequest("/sign-out", {
      method: "POST",
      headers: { cookie: sessionCookie!, "content-type": "application/json" },
      body: "{}",
    }));
    expect(signedOut.status).toBe(200);
    const afterSignOut = await auth.handler(authRequest("/get-session", {
      headers: { cookie: sessionCookie! },
    }));
    expect(afterSignOut.status).toBe(200);
    expect(await afterSignOut.json()).toBeNull();

    const sessionsAfterSignOut = await db.select().from(sessions).where(eq(sessions.userId, createdUsers[0]!.id));
    expect(sessionsAfterSignOut.filter((session) => session.expiresAt.getTime() > Date.now())).toHaveLength(0);

    const replay = await auth.handler(new Request(link.url, {
      headers: { origin: "https://www.quickiching.com" },
    }));
    expect([302, 303]).toContain(replay.status);
    expect(replay.headers.get("location")).toContain("error=INVALID_TOKEN");
  });

  it("atomically consumes one Magic Link token when two verification requests race", async () => {
    sentLinks.length = 0;
    const start = await auth.handler(authRequest("/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "concurrent.integration@example.com", callbackURL: "/signin" }),
    }));
    expect(start.status).toBe(200);
    const link = sentLinks[0]!;

    const [first, second] = await Promise.all([
      auth.handler(new Request(link.url, { headers: { origin: "https://www.quickiching.com" } })),
      auth.handler(new Request(link.url, { headers: { origin: "https://www.quickiching.com" } })),
    ]);
    const responses = [first, second];
    expect(responses.filter((response) => response.headers.get("location")?.includes("error=INVALID_TOKEN"))).toHaveLength(1);
    expect(responses.filter((response) => !response.headers.get("location")?.includes("error=INVALID_TOKEN"))).toHaveLength(1);

    const createdUsers = await db.select().from(users).where(eq(users.email, "concurrent.integration@example.com"));
    expect(createdUsers).toHaveLength(1);
    const createdSessions = await db.select().from(sessions).where(eq(sessions.userId, createdUsers[0]!.id));
    expect(createdSessions).toHaveLength(1);
  });

  it("does not expose an email-specific response when requesting a Magic Link", async () => {
    const existing = await auth.handler(authRequest("/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "magic.integration@example.com", callbackURL: "/signin" }),
    }));
    const unknown = await auth.handler(authRequest("/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "another.integration@example.com", callbackURL: "/signin" }),
    }));
    expect(existing.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await jsonResponse(existing)).toEqual(await jsonResponse(unknown));
  });

  it("does not return success or provider details when Magic Link delivery fails", async () => {
    const failingTransport = createMagicLinkEmailTransport(async () => {
      throw new Error("provider-api-key-and-token-must-not-escape");
    });
    const failingAuth = betterAuth(buildAuthOptions(db, {
      NODE_ENV: "test",
      BETTER_AUTH_URL: "https://www.quickiching.com",
      BETTER_AUTH_SECRET: "failing-transport-secret-with-32-character-minimum",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM: "Quick I Ching <noreply@example.com>",
    }, failingTransport));
    const response = await failingAuth.handler(authRequest("/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "delivery-failure.integration@example.com", callbackURL: "/signin" }),
    }));

    expect(response.status).not.toBe(200);
    const body = await response.text();
    expect(body).not.toContain("provider-api-key-and-token-must-not-escape");
    expect(body).not.toContain("re_test_key");
  });

  it("starts Google OAuth with provider-generated state and PKCE without calling Google", async () => {
    const response = await auth.handler(authRequest("/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "google", callbackURL: "/signin" }),
    }));
    expect(response.status).toBe(200);
    const body = await jsonResponse(response);
    const providerURL = new URL(String(body.url));
    expect(providerURL.origin).toBe("https://accounts.google.com");
    expect(providerURL.searchParams.get("state")).toBeTruthy();
    expect(providerURL.searchParams.get("code_challenge")).toBeTruthy();
    expect(providerURL.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("rejects an external OAuth callback before provider navigation", async () => {
    const response = await auth.handler(authRequest("/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "google", callbackURL: "https://evil.example/steal" }),
    }));
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects an expired Magic Link token", async () => {
    sentLinks.length = 0;
    const start = await auth.handler(authRequest("/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "expired.integration@example.com", callbackURL: "/signin" }),
    }));
    expect(start.status).toBe(200);
    const link = sentLinks[0]!;
    await db.update(verifications).set({ expiresAt: new Date(Date.now() - 1000) });
    const expired = await auth.handler(new Request(link.url, {
      headers: { origin: "https://www.quickiching.com" },
    }));
    expect([302, 303]).toContain(expired.status);
    expect(expired.headers.get("location")).toContain("error=INVALID_TOKEN");
  });

  it("never performs Google, Resend, or other provider HTTP during the integration suite", () => {
    expect(externalProviderRequests).toEqual([]);
  });
});
