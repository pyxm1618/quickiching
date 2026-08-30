import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { databaseSchema } from "@/server/db/schema";
import {
  checkSystemReadiness,
  REQUIRED_COMMERCIAL_TABLES,
  REQUIRED_MIGRATION_CHECKPOINT_AT,
} from "./readiness-service";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");

const sql = postgres(databaseURL, { max: 4, prepare: false });
const db = drizzle(sql, { schema: databaseSchema });

// The unit suite exercises checkSystemReadiness through dbOverride. This suite
// covers the default path it takes in production: the real table inventory and
// the real drizzle.__drizzle_migrations log.
describe("System readiness against a migrated PostgreSQL database", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("finds every required commercial table in the migrated schema", async () => {
    const rows = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables where table_schema = 'public'
    `;
    const existing = rows.map((row) => row.table_name);
    const missing = REQUIRED_COMMERCIAL_TABLES.filter((table) => !existing.includes(table));

    expect(missing).toEqual([]);
  });

  it("reads the applied migration log the same way the default readiness path does", async () => {
    const rows = await sql<{ created_at: string | number | null }[]>`
      SELECT created_at FROM drizzle.__drizzle_migrations
    `;
    const applied = rows
      .map((row) => Number(row.created_at))
      .filter((value) => Number.isFinite(value));

    expect(applied.length).toBeGreaterThan(0);
    expect(Math.max(...applied)).toBeGreaterThanOrEqual(REQUIRED_MIGRATION_CHECKPOINT_AT);
  });

  it("reports the database as ok when connected to the fully migrated database", async () => {
    const report = await checkSystemReadiness(
      { DATABASE_URL: databaseURL },
      {
        ping: async () => {
          await sql`SELECT 1`;
        },
        queryTables: async () => {
          const rows = await sql<{ table_name: string }[]>`
            select table_name from information_schema.tables where table_schema = 'public'
          `;
          return rows.map((row) => row.table_name);
        },
        queryMigrationTimestamps: async () => {
          const rows = await sql<{ created_at: string | number | null }[]>`
            SELECT created_at FROM drizzle.__drizzle_migrations
          `;
          return rows.map((row) => Number(row.created_at)).filter((value) => Number.isFinite(value));
        },
      },
    );

    expect(report.database.status).toBe("ok");
    expect(report.database.connected).toBe(true);
    expect(report.database.appliedMigrationAt).toBeGreaterThanOrEqual(REQUIRED_MIGRATION_CHECKPOINT_AT);
    // Capabilities are all off in this env, so the overall verdict stays blocked.
    expect(report.status).toBe("not_ready");
  });
});
