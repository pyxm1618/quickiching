import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { betterAuthSchema } from "./auth-schema";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("production Better Auth database mapping", () => {
  let sql: Sql;

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 4 });
    await migratePostgres(sql);
  });

  beforeEach(async () => {
    await resetPostgresForTests(sql);
  });

  afterAll(async () => {
    if (sql) await sql.end();
  });

  it("writes a hashed magic-link verification through the real Drizzle adapter", async () => {
    const baseURL = "https://example.com";
    const db = drizzle(sql, { schema: betterAuthSchema });
    let sentUrl = "";
    const auth = betterAuth({
      baseURL,
      secret: "better-auth-integration-secret-at-least-32-characters",
      trustedOrigins: [baseURL],
      database: drizzleAdapter(db, {
        provider: "pg",
        schema: betterAuthSchema,
      }),
      advanced: {
        database: {
          generateId: () => randomUUID(),
        },
      },
      plugins: [
        magicLink({
          expiresIn: 600,
          storeToken: "hashed",
          sendMagicLink: async ({ url }) => {
            sentUrl = url;
          },
        }),
      ],
    });

    await auth.api.signInMagicLink({
      body: {
        email: "magic-link@example.com",
        callbackURL: "/account",
      },
      headers: new Headers({ origin: baseURL }),
    });

    const token = new URL(sentUrl).searchParams.get("token");
    const rows = await sql`
      select identifier, value, expires_at
      from auth_verifications
    `;

    expect(token).toBeTruthy();
    expect(rows).toHaveLength(1);
    expect([rows[0]?.identifier, rows[0]?.value]).not.toContain(token);
    expect(new Date(String(rows[0]?.expires_at)).getTime()).toBeGreaterThan(Date.now());
  });
});
