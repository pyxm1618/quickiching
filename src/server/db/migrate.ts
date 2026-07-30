import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Sql } from "postgres";

const MIGRATION_IDS = ["0000_v2_1", "0001_auth_payments"] as const;
const MIGRATION_LOCK = 8_924_211_607;

export async function migratePostgres(sql: Sql): Promise<void> {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS _app_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${MIGRATION_LOCK})`;
    for (const migrationId of MIGRATION_IDS) {
      const existing = await tx`select id from _app_migrations where id = ${migrationId}`;
      if (existing.length > 0) continue;
      const migrationSql = await readFile(
        path.join(process.cwd(), "drizzle", `${migrationId}.sql`),
        "utf8",
      );
      await tx.unsafe(migrationSql);
      await tx`insert into _app_migrations (id) values (${migrationId})`;
    }
  });
}

export async function resetPostgresForTests(sql: Sql): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_TEST_RESET_FORBIDDEN");
  }
  await sql.unsafe(`
    TRUNCATE TABLE
      auth_verifications,
      auth_accounts,
      auth_sessions,
      auth_users,
      webhook_inbox,
      outbox,
      generation_jobs,
      quality_reviews,
      orders,
      entitlement_ledger,
      reservations,
      entitlement_batches,
      readings,
      previews,
      question_locks,
      cast_results,
      casting_steps,
      casting_risk_decisions,
      question_versions,
      login_intents,
      casting_sessions,
      sessions,
      users
    CASCADE
  `);
}
