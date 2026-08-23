import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { authTables, users } from "@/server/db/auth-schema";
import { closeAuthDatabaseConnection } from "@/server/db/client";
import { GET as authRouteGET } from "@/app/api/auth/[...all]/route";
import { isAuthCapabilityEnabled } from "./capability";
import { consumeLoginIntent, createLoginIntent } from "./login-intent";
import { getAuth, getAuthHandler, resetAuthForTests } from "./server";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for Auth runtime integration tests");

const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql, { schema: authTables });
const runtimeEnv: Record<string, string> = {
  NODE_ENV: "test",
  COMMERCIAL_V2_AUTH_ENABLED: "true",
  COMMERCIAL_V2_AI_PREVIEW_ENABLED: "false",
  COMMERCIAL_V2_CHECKOUT_ENABLED: "false",
  COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "false",
  COMMERCIAL_V2_PAID_DEEP_READING_ENABLED: "false",
  COMMERCIAL_V2_RECONCILE_ENABLED: "false",
  AUTH_ADAPTER_MODE: "better-auth",
  DATABASE_ADAPTER_MODE: "postgres",
  DATABASE_URL: databaseURL,
  BETTER_AUTH_SECRET: "runtime-integration-secret-with-32-character-minimum",
  BETTER_AUTH_URL: "https://www.quickiching.com",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM: "Quick I Ching <noreply@example.com>",
  ANONYMOUS_OWNER_KEYS: "v1:anonymous-owner-secret",
};

describe("CP2 Auth capability runtime", () => {
  beforeAll(async () => {
    Object.assign(process.env, runtimeEnv);
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    for (const key of Object.keys(runtimeEnv)) delete process.env[key];
    resetAuthForTests();
    await closeAuthDatabaseConnection();
    await sql.end({ timeout: 5 });
  });

  it("enables only the implemented Auth capability and uses the PostgreSQL-backed handler", async () => {
    expect(isAuthCapabilityEnabled()).toBe(true);
    const response = await getAuthHandler().GET(new Request("https://www.quickiching.com/api/auth/get-session", {
      headers: { origin: "https://www.quickiching.com" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
    const routeResponse = await authRouteGET(new Request("https://www.quickiching.com/api/auth/get-session", {
      headers: { origin: "https://www.quickiching.com" },
    }));
    expect(routeResponse.status).toBe(200);
    expect(await routeResponse.json()).toBeNull();
    await db.insert(users).values({
      id: "runtime-login-intent-user",
      name: "Runtime User",
      email: "runtime-login-intent@example.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const intent = await createLoginIntent({
      ownerDigest: "runtime-owner-digest",
      targetResource: "casting:runtime",
      callbackURL: "/signin",
    }, "https://www.quickiching.com");
    await expect(consumeLoginIntent({
      intentId: intent.id,
      ownerDigest: "runtime-owner-digest",
      targetResource: "casting:runtime",
      userId: "runtime-login-intent-user",
    })).resolves.toMatchObject({ consumedUserId: "runtime-login-intent-user" });
    expect(getAuth()).toBeDefined();
  });
});
