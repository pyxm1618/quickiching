import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { betterAuth } from "better-auth";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { POST as saveReading } from "@/app/api/readings/route";
import { resolveSession } from "@/lib/auth/session";
import { authTables } from "@/server/db/auth-schema";
import {
  closeAuthDatabaseConnection,
  closeCommercialDatabaseConnection,
} from "@/server/db/client";
import { loadHistory } from "@/server/loaders";
import { buildAuthOptions, resetAuthForTests } from "@/server/auth/server";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required");

const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql, { schema: authTables });
const runtimeEnv: Record<string, string> = {
  NODE_ENV: "test",
  COMMERCIAL_V2_AUTH_ENABLED: "true",
  COMMERCIAL_V2_CHECKOUT_ENABLED: "false",
  COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "false",
  COMMERCIAL_V2_PAID_DEEP_READING_ENABLED: "false",
  COMMERCIAL_V2_RECONCILE_ENABLED: "false",
  AUTH_ADAPTER_MODE: "better-auth",
  DATABASE_ADAPTER_MODE: "postgres",
  DATABASE_URL: databaseURL,
  BETTER_AUTH_SECRET: "three-coin-auth-history-secret-with-32-character-minimum",
  BETTER_AUTH_URL: "https://www.quickiching.com",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM: "Quick I Ching <noreply@example.com>",
  ANONYMOUS_OWNER_KEYS: "v1:three-coin-anonymous-owner-secret",
  QUESTION_FINGERPRINT_KEYS: "v1:three-coin-fingerprint-secret",
  QUESTION_ENCRYPTION_KEYS: "v1:three-coin-encryption-secret",
  RESULT_INTEGRITY_KEYS: "v1:three-coin-integrity-secret",
};

const sentLinks: Array<{ email: string; url: string }> = [];
const previousEnv = new Map<string, string | undefined>();
const loginAuth = betterAuth(buildAuthOptions(db, runtimeEnv, {
  sendMagicLink: async (data) => {
    sentLinks.push({ email: data.email, url: data.url });
  },
}));

function authRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("origin", "https://www.quickiching.com");
  return new Request(`https://www.quickiching.com/api/auth${path}`, { ...init, headers });
}

function readingRequest(cookie: string, body: unknown) {
  return new Request("https://www.quickiching.com/api/readings", {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      origin: "https://www.quickiching.com",
      referer: "https://www.quickiching.com/readings/three-coin/result",
      "sec-fetch-site": "same-origin",
      host: "www.quickiching.com",
    },
    body: JSON.stringify(body),
  });
}

describe("Three-Coin real Auth -> save -> account History integration", () => {
  beforeAll(async () => {
    for (const key of Object.keys(runtimeEnv)) previousEnv.set(key, process.env[key]);
    Object.assign(process.env, runtimeEnv);
    resetAuthForTests();
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    resetAuthForTests();
    await closeAuthDatabaseConnection();
    await closeCommercialDatabaseConnection();
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    previousEnv.clear();
    await sql.end({ timeout: 5 });
  });

  it("uses a real Better Auth Magic Link session to save the exact cast and read it back from account History", async () => {
    const email = `three-coin-${randomUUID()}@integration.example`;
    sentLinks.length = 0;

    const started = await loginAuth.handler(authRequest("/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        callbackURL: "/readings/three-coin/result",
      }),
    }));
    expect(started.status).toBe(200);
    expect(sentLinks).toHaveLength(1);

    const verified = await loginAuth.handler(new Request(sentLinks[0]!.url, {
      headers: { origin: "https://www.quickiching.com" },
    }));
    expect([200, 302, 303]).toContain(verified.status);
    const setCookie = verified.headers.get("set-cookie") ?? "";
    const sessionCookie = setCookie.match(/(?:__Secure-)?better-auth\.session_token=[^;]+/)?.[0];
    expect(sessionCookie).toBeDefined();

    resetAuthForTests();
    const resolved = await resolveSession(new Headers({
      cookie: sessionCookie!,
      origin: "https://www.quickiching.com",
    }));
    expect(resolved?.user.email).toBe(email);

    const clientCastingId = randomUUID();
    const lineValuesBottomUp = [7, 8, 9, 6, 7, 8];
    const payload = {
      clientCastingId,
      lineValuesBottomUp,
      question: "Should I continue with the current product direction?",
      scene: "career",
      interpretationGoal: "what_do_i_need_to_see_clearly",
    };

    const first = await saveReading(readingRequest(sessionCookie!, payload));
    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({
      castingId: clientCastingId,
      idempotent: false,
    });

    const retry = await saveReading(readingRequest(sessionCookie!, payload));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({
      castingId: clientCastingId,
      idempotent: true,
    });

    const rows = await sql`
      select c.id, c.user_id, c.method, c.lifecycle, r.line_values
      from casting_sessions c
      join cast_results r on r.casting_id = c.id
      where c.id = ${clientCastingId}
    ` as Array<{
      id: string;
      user_id: string;
      method: string;
      lifecycle: string;
      line_values: number[];
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: clientCastingId,
      user_id: resolved!.user.id,
      method: "three_coin",
      lifecycle: "revealed",
    });
    expect(rows[0]!.line_values).toEqual(lineValuesBottomUp);

    const history = await loadHistory(resolved!.user);
    const saved = history.find((entry) => entry.id === clientCastingId);
    expect(saved).toMatchObject({
      id: clientCastingId,
      method: "three_coin",
      lifecycle: "revealed",
    });
    expect(saved?.primaryName).toBeTruthy();

    const duplicateCount = await sql`
      select count(*)::integer as count
      from casting_sessions
      where id = ${clientCastingId}
    ` as Array<{ count: number }>;
    expect(duplicateCount[0]?.count).toBe(1);
  });
});
