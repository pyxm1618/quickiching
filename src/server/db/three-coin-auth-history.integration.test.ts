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
import { loadMyReadings } from "@/server/loaders";
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

describe("Three-Coin real Auth -> save -> Account My Readings integration", () => {
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

  it("uses real Better Auth to preserve cast idempotency while allowing a new reading for the same question", async () => {
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

    const repeatedCastingId = randomUUID();
    const repeatedLineValuesBottomUp = [8, 7, 6, 9, 8, 7];
    const repeatedPayload = {
      ...payload,
      clientCastingId: repeatedCastingId,
      lineValuesBottomUp: repeatedLineValuesBottomUp,
    };

    const repeated = await saveReading(readingRequest(sessionCookie!, repeatedPayload));
    expect(repeated.status).toBe(201);
    expect(await repeated.json()).toEqual({
      castingId: repeatedCastingId,
      idempotent: false,
    });

    const repeatedRetry = await saveReading(readingRequest(sessionCookie!, repeatedPayload));
    expect(repeatedRetry.status).toBe(200);
    expect(await repeatedRetry.json()).toEqual({
      castingId: repeatedCastingId,
      idempotent: true,
    });

    const rows = await sql`
      select c.id, c.user_id, c.method, c.lifecycle, c.question_fingerprint, r.line_values
      from casting_sessions c
      join cast_results r on r.casting_id = c.id
      where c.id in (${clientCastingId}, ${repeatedCastingId})
      order by c.id
    ` as Array<{
      id: string;
      user_id: string;
      method: string;
      lifecycle: string;
      question_fingerprint: string | null;
      line_values: number[];
    }>;
    expect(rows).toHaveLength(2);

    const firstRow = rows.find((row) => row.id === clientCastingId);
    const repeatedRow = rows.find((row) => row.id === repeatedCastingId);
    expect(firstRow).toMatchObject({
      id: clientCastingId,
      user_id: resolved!.user.id,
      method: "three_coin",
      lifecycle: "revealed",
    });
    expect(firstRow!.line_values).toEqual(lineValuesBottomUp);
    expect(repeatedRow).toMatchObject({
      id: repeatedCastingId,
      user_id: resolved!.user.id,
      method: "three_coin",
      lifecycle: "revealed",
    });
    expect(repeatedRow!.line_values).toEqual(repeatedLineValuesBottomUp);
    expect(repeatedRow!.question_fingerprint).toBe(firstRow!.question_fingerprint);
    expect(firstRow!.question_fingerprint).toBeTruthy();

    const history = await loadMyReadings(resolved!.user);
    const saved = history.find((entry) => entry.id === clientCastingId);
    const repeatedSaved = history.find((entry) => entry.id === repeatedCastingId);
    expect(saved).toMatchObject({
      id: clientCastingId,
      method: "three_coin",
      lifecycle: "revealed",
    });
    expect(repeatedSaved).toMatchObject({
      id: repeatedCastingId,
      method: "three_coin",
      lifecycle: "revealed",
    });
    expect(saved?.primaryName).toBeTruthy();
    expect(repeatedSaved?.primaryName).toBeTruthy();

    const savedCount = await sql`
      select count(*)::integer as count
      from casting_sessions
      where id in (${clientCastingId}, ${repeatedCastingId})
    ` as Array<{ count: number }>;
    expect(savedCount[0]?.count).toBe(2);

  });
});
