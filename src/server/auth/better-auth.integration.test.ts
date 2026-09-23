import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { accounts, authTables, sessions, users, verifications } from "@/server/db/auth-schema";
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

function createGoogleIdTokenAuth(input: {
  email: string;
  subject: string;
  emailVerified?: boolean;
}) {
  const options = buildAuthOptions(db, {
    NODE_ENV: "test",
    BETTER_AUTH_URL: "https://www.quickiching.com",
    BETTER_AUTH_SECRET: "linking-test-secret-with-32-character-minimum",
    GOOGLE_CLIENT_ID: "google-client-id",
    GOOGLE_CLIENT_SECRET: "google-client-secret",
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "Quick I Ching <noreply@example.com>",
  }, {
    sendMagicLink: async (data) => {
      sentLinks.push({ email: data.email, url: data.url, token: data.token });
    },
  });
  return betterAuth({
    ...options,
    socialProviders: {
      ...options.socialProviders,
      google: {
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
        requireEmailVerification: true,
        verifyIdToken: async () => true,
        getUserInfo: async () => ({
          user: {
            name: "Google Test User",
            email: input.email,
            emailVerified: input.emailVerified ?? true,
          },
          data: {
            aud: "google-client-id",
            azp: "google-client-id",
            email: input.email,
            email_verified: input.emailVerified ?? true,
            exp: Math.floor(Date.now() / 1000) + 3600,
            family_name: "User",
            given_name: "Google Test",
            iat: Math.floor(Date.now() / 1000),
            iss: "https://accounts.google.com",
            name: "Google Test User",
            picture: "https://example.com/avatar.png",
            sub: input.subject,
          },
        }),
      },
    },
  });
}

async function signInWithGoogleIdToken(
  testAuth: ReturnType<typeof createGoogleIdTokenAuth>,
  token: string,
) {
  return testAuth.handler(authRequest("/sign-in/social", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "google",
      callbackURL: "/signin",
      idToken: { token },
    }),
  }));
}

async function redeemLatestMagicLink(testAuth: ReturnType<typeof createGoogleIdTokenAuth>) {
  const link = sentLinks.at(-1);
  if (!link) throw new Error("MAGIC_LINK_NOT_SENT");
  return testAuth.handler(new Request(link.url, {
    headers: { origin: "https://www.quickiching.com" },
  }));
}

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

  it("links Google to an existing Magic Link user with the same verified email", async () => {
    const email = "magic-then-google.integration@example.com";
    const testAuth = createGoogleIdTokenAuth({
      email,
      subject: "google-magic-then-google",
    });

    sentLinks.length = 0;
    const magicStart = await testAuth.handler(authRequest("/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, callbackURL: "/signin" }),
    }));
    expect(magicStart.status).toBe(200);
    const magicVerified = await redeemLatestMagicLink(testAuth);
    expect([200, 302, 303]).toContain(magicVerified.status);

    const beforeGoogle = await db.select().from(users).where(eq(users.email, email));
    expect(beforeGoogle).toHaveLength(1);
    expect(beforeGoogle[0]?.emailVerified).toBe(true);
    const originalUserId = beforeGoogle[0]!.id;

    const googleSignIn = await signInWithGoogleIdToken(testAuth, "token-magic-then-google");
    expect(googleSignIn.status).toBe(200);

    const afterGoogle = await db.select().from(users).where(eq(users.email, email));
    expect(afterGoogle).toHaveLength(1);
    expect(afterGoogle[0]!.id).toBe(originalUserId);

    const googleAccounts = await db.select().from(accounts).where(eq(accounts.providerId, "google"));
    const linked = googleAccounts.find((account) => account.accountId === "google-magic-then-google");
    expect(linked?.userId).toBe(originalUserId);

    const userSessions = await db.select().from(sessions).where(eq(sessions.userId, originalUserId));
    expect(userSessions.length).toBeGreaterThanOrEqual(2);
  });

  it("reuses an existing Google user when the same email later uses Magic Link", async () => {
    const email = "google-then-magic.integration@example.com";
    const testAuth = createGoogleIdTokenAuth({
      email,
      subject: "google-google-then-magic",
    });

    const googleSignIn = await signInWithGoogleIdToken(testAuth, "token-google-then-magic");
    expect(googleSignIn.status).toBe(200);
    const afterGoogle = await db.select().from(users).where(eq(users.email, email));
    expect(afterGoogle).toHaveLength(1);
    const originalUserId = afterGoogle[0]!.id;

    sentLinks.length = 0;
    const magicStart = await testAuth.handler(authRequest("/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, callbackURL: "/signin" }),
    }));
    expect(magicStart.status).toBe(200);
    const magicVerified = await redeemLatestMagicLink(testAuth);
    expect([200, 302, 303]).toContain(magicVerified.status);

    const afterMagic = await db.select().from(users).where(eq(users.email, email));
    expect(afterMagic).toHaveLength(1);
    expect(afterMagic[0]!.id).toBe(originalUserId);

    const userSessions = await db.select().from(sessions).where(eq(sessions.userId, originalUserId));
    expect(userSessions.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps one user and one Google identity across alternating Google and Magic Link sign-ins", async () => {
    const email = "alternating.integration@example.com";
    const subject = "google-alternating";
    const testAuth = createGoogleIdTokenAuth({ email, subject });

    expect((await signInWithGoogleIdToken(testAuth, "token-alternating-1")).status).toBe(200);

    sentLinks.length = 0;
    expect((await testAuth.handler(authRequest("/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, callbackURL: "/signin" }),
    }))).status).toBe(200);
    expect([200, 302, 303]).toContain((await redeemLatestMagicLink(testAuth)).status);

    expect((await signInWithGoogleIdToken(testAuth, "token-alternating-2")).status).toBe(200);

    sentLinks.length = 0;
    expect((await testAuth.handler(authRequest("/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, callbackURL: "/signin" }),
    }))).status).toBe(200);
    expect([200, 302, 303]).toContain((await redeemLatestMagicLink(testAuth)).status);

    const matchingUsers = await db.select().from(users).where(eq(users.email, email));
    expect(matchingUsers).toHaveLength(1);

    const googleAccounts = await db.select().from(accounts).where(eq(accounts.providerId, "google"));
    const matchingAccounts = googleAccounts.filter((account) => account.accountId === subject);
    expect(matchingAccounts).toHaveLength(1);
    expect(matchingAccounts[0]!.userId).toBe(matchingUsers[0]!.id);
  });

  it("does not create duplicate users for repeated use of the same Google identity", async () => {
    const email = "same-google.integration@example.com";
    const subject = "google-same-identity";
    const testAuth = createGoogleIdTokenAuth({ email, subject });

    expect((await signInWithGoogleIdToken(testAuth, "same-google-token-1")).status).toBe(200);
    expect((await signInWithGoogleIdToken(testAuth, "same-google-token-2")).status).toBe(200);

    const matchingUsers = await db.select().from(users).where(eq(users.email, email));
    expect(matchingUsers).toHaveLength(1);
    const googleAccounts = await db.select().from(accounts).where(eq(accounts.providerId, "google"));
    expect(googleAccounts.filter((account) => account.accountId === subject)).toHaveLength(1);
  });

  it("keeps different verified emails as different logical users", async () => {
    const firstEmail = "different-a.integration@example.com";
    const secondEmail = "different-b.integration@example.com";
    const firstAuth = createGoogleIdTokenAuth({ email: firstEmail, subject: "google-different-a" });
    const secondAuth = createGoogleIdTokenAuth({ email: secondEmail, subject: "google-different-b" });

    expect((await signInWithGoogleIdToken(firstAuth, "different-token-a")).status).toBe(200);
    expect((await signInWithGoogleIdToken(secondAuth, "different-token-b")).status).toBe(200);

    const firstUsers = await db.select().from(users).where(eq(users.email, firstEmail));
    const secondUsers = await db.select().from(users).where(eq(users.email, secondEmail));
    expect(firstUsers).toHaveLength(1);
    expect(secondUsers).toHaveLength(1);
    expect(firstUsers[0]!.id).not.toBe(secondUsers[0]!.id);
  });

  it("rejects an unverified Google email without creating a user or account", async () => {
    const email = "unverified-google.integration@example.com";
    const subject = "google-unverified";
    const testAuth = createGoogleIdTokenAuth({
      email,
      subject,
      emailVerified: false,
    });

    const response = await signInWithGoogleIdToken(testAuth, "unverified-google-token");
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await db.select().from(users).where(eq(users.email, email))).toHaveLength(0);

    const googleAccounts = await db.select().from(accounts).where(eq(accounts.providerId, "google"));
    expect(googleAccounts.filter((account) => account.accountId === subject)).toHaveLength(0);
  });

  it("never rebinds an existing Google identity to a different email", async () => {
    const subject = "google-non-rebindable";
    const firstEmail = "identity-owner.integration@example.com";
    const attemptedEmail = "identity-takeover.integration@example.com";
    const ownerAuth = createGoogleIdTokenAuth({ email: firstEmail, subject });
    const conflictingAuth = createGoogleIdTokenAuth({ email: attemptedEmail, subject });

    expect((await signInWithGoogleIdToken(ownerAuth, "identity-owner-token")).status).toBe(200);
    const ownerUsers = await db.select().from(users).where(eq(users.email, firstEmail));
    expect(ownerUsers).toHaveLength(1);
    const ownerUserId = ownerUsers[0]!.id;

    const secondSignIn = await signInWithGoogleIdToken(conflictingAuth, "identity-conflict-token");
    expect(secondSignIn.status).toBe(200);

    expect(await db.select().from(users).where(eq(users.email, attemptedEmail))).toHaveLength(0);
    const googleAccounts = await db.select().from(accounts).where(eq(accounts.providerId, "google"));
    const matchingAccounts = googleAccounts.filter((account) => account.accountId === subject);
    expect(matchingAccounts).toHaveLength(1);
    expect(matchingAccounts[0]!.userId).toBe(ownerUserId);
  });

  it("never performs Google, Resend, or other provider HTTP during the integration suite", () => {
    expect(externalProviderRequests).toEqual([]);
  });
});
