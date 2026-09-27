import { spawnSync } from "node:child_process";
import postgres from "postgres";
import migrationIntegrity from "../drizzle/migration-integrity.json";
import {
  classifyAppliedMigrationHistory,
  classifyMigration0012Schema,
  MIGRATION_0012_REQUIRED_OBJECTS,
  resolveProductionDatabaseUrl,
  type ProductionEnvironmentEntry,
} from "../src/server/readiness/production-schema-release";
import { REQUIRED_COMMERCIAL_TABLES } from "../src/server/readiness/readiness-service";

const PRODUCTION_PROJECT_ID = "prj_pCpeoAys2GOqKZvkbLugYjpJWZBS";
const PRODUCTION_TEAM_ID = "team_z1b9TTQtbNkr43dzs5JVJPnQ";
const EXPECTED_MIGRATIONS = migrationIntegrity.migrations.map(({ createdAt, hash }) => ({ createdAt, hash }));
const EXISTING_COMMERCIAL_TABLES = REQUIRED_COMMERCIAL_TABLES.filter(
  (table) => table !== "question_locks" && table !== "deep_reading_context_snapshots",
);

async function fetchProductionDatabaseUrl(): Promise<string> {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) throw new Error("VERCEL_TOKEN_UNAVAILABLE");
  if (process.env.VERCEL_PROJECT_ID?.trim() !== PRODUCTION_PROJECT_ID) {
    throw new Error("PRODUCTION_PROJECT_BINDING_MISMATCH");
  }
  if (process.env.VERCEL_TEAM_ID?.trim() !== PRODUCTION_TEAM_ID) {
    throw new Error("PRODUCTION_TEAM_BINDING_MISMATCH");
  }

  const url = new URL(`https://api.vercel.com/v10/projects/${PRODUCTION_PROJECT_ID}/env`);
  url.searchParams.set("teamId", PRODUCTION_TEAM_ID);
  url.searchParams.set("decrypt", "true");
  url.searchParams.set("source", "vercel-cli:pull");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`VERCEL_PRODUCTION_ENV_FETCH_FAILED:${response.status}`);
  const payload = await response.json() as { envs?: ProductionEnvironmentEntry[] };
  if (!Array.isArray(payload.envs)) throw new Error("VERCEL_PRODUCTION_ENV_RESPONSE_INVALID");

  return resolveProductionDatabaseUrl(payload.envs, async (environmentId) => {
    const envUrl = new URL(`https://api.vercel.com/v1/projects/${PRODUCTION_PROJECT_ID}/env/${encodeURIComponent(environmentId)}`);
    envUrl.searchParams.set("teamId", PRODUCTION_TEAM_ID);
    const envResponse = await fetch(envUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!envResponse.ok) throw new Error(`VERCEL_PRODUCTION_ENV_DECRYPT_FAILED:${envResponse.status}`);
    return await envResponse.json() as { key?: unknown; value?: unknown; decrypted?: unknown };
  });
}

async function readSchemaObjects(sql: ReturnType<typeof postgres>): Promise<string[]> {
  const rows = await sql<{ object_name: string }[]>`
    SELECT object_name FROM (
      SELECT 'table:' || table_name AS object_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      UNION
      SELECT 'column:' || table_name || '.' || column_name AS object_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      UNION
      SELECT 'index:' || tablename || '.' || indexname AS object_name
      FROM pg_indexes
      WHERE schemaname = 'public'
      UNION
      SELECT 'constraint:' || relation.relname || '.' || constraint_row.conname AS object_name
      FROM pg_constraint constraint_row
      JOIN pg_class relation ON relation.oid = constraint_row.conrelid
      JOIN pg_namespace relation_schema ON relation_schema.oid = relation.relnamespace
      WHERE relation_schema.nspname = 'public'
      UNION
      SELECT 'function:' || routine_name AS object_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      UNION
      SELECT 'foreign_key:' || child_relation.relname || '.' || child_column.attname
        || '->' || parent_relation.relname || '.' || parent_column.attname
        || ':' || CASE constraint_row.confdeltype WHEN 'c' THEN 'cascade' ELSE 'other' END AS object_name
      FROM pg_constraint constraint_row
      JOIN pg_class child_relation ON child_relation.oid = constraint_row.conrelid
      JOIN pg_namespace child_schema ON child_schema.oid = child_relation.relnamespace
      JOIN pg_class parent_relation ON parent_relation.oid = constraint_row.confrelid
      JOIN LATERAL unnest(constraint_row.conkey) WITH ORDINALITY child_key(attnum, ordinal) ON true
      JOIN LATERAL unnest(constraint_row.confkey) WITH ORDINALITY parent_key(attnum, ordinal)
        ON parent_key.ordinal = child_key.ordinal
      JOIN pg_attribute child_column
        ON child_column.attrelid = child_relation.oid AND child_column.attnum = child_key.attnum
      JOIN pg_attribute parent_column
        ON parent_column.attrelid = parent_relation.oid AND parent_column.attnum = parent_key.attnum
      WHERE constraint_row.contype = 'f' AND child_schema.nspname = 'public'
      UNION
      SELECT 'trigger:' || relation.relname || '.' || trigger_row.tgname AS object_name
      FROM pg_trigger trigger_row
      JOIN pg_class relation ON relation.oid = trigger_row.tgrelid
      JOIN pg_namespace relation_schema ON relation_schema.oid = relation.relnamespace
      WHERE relation_schema.nspname = 'public' AND NOT trigger_row.tgisinternal AND trigger_row.tgenabled <> 'D'
    ) schema_objects
  `;
  return rows.map((row) => row.object_name);
}

async function readAppliedMigrations(sql: ReturnType<typeof postgres>): Promise<{ createdAt: number; hash: string }[]> {
  const rows = await sql<{ created_at: string | number | bigint; hash: string }[]>`
    SELECT created_at, hash FROM drizzle.__drizzle_migrations ORDER BY id ASC
  `;
  return rows.map((row) => ({ createdAt: Number(row.created_at), hash: row.hash }));
}

async function readExistingRowCounts(sql: ReturnType<typeof postgres>): Promise<Record<string, string>> {
  const entries = await Promise.all(EXISTING_COMMERCIAL_TABLES.map(async (table) => {
    const identifier = `public."${table.replaceAll('"', '""')}"`;
    const rows = await sql.unsafe(`SELECT count(*)::text AS row_count FROM ${identifier}`) as { row_count: string }[];
    return [table, rows[0]?.row_count ?? "0"] as const;
  }));
  return Object.fromEntries(entries);
}

function runOfficialDrizzleMigration(databaseUrl: string): void {
  const result = spawnSync("bun", ["run", "db:migrate"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl, MIGRATION_DATABASE_URL: databaseUrl },
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
    .replaceAll(databaseUrl, "[REDACTED_DATABASE_URL]")
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_DATABASE_URL]")
    .trim();
  if (output) console.log(output);
  if (result.error) {
    const code = "code" in result.error && typeof result.error.code === "string" ? result.error.code : "UNKNOWN";
    throw new Error(`DRIZZLE_MIGRATION_START_FAILED:${code}`);
  }
  if (result.status !== 0) throw new Error(`DRIZZLE_MIGRATION_FAILED:${result.status ?? "NO_EXIT_STATUS"}`);
}

async function main(): Promise<void> {
  const action = process.env.PRODUCTION_SCHEMA_ACTION?.trim();
  if (action !== "inspect" && action !== "migrate") throw new Error("PRODUCTION_SCHEMA_ACTION_INVALID");
  if (EXPECTED_MIGRATIONS.length !== 13 || migrationIntegrity.migrations[12]?.tag !== "0012_deep_reading_context_contract") {
    throw new Error("EXPECTED_PRODUCTION_MIGRATION_0012_NOT_CURRENT");
  }

  const databaseUrl = await fetchProductionDatabaseUrl();
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10 });
  try {
    const beforeObjects = await readSchemaObjects(sql);
    const beforeSchema = classifyMigration0012Schema(beforeObjects);
    const beforeMigrations = await readAppliedMigrations(sql);
    const beforeHistory = classifyAppliedMigrationHistory(beforeMigrations, EXPECTED_MIGRATIONS);
    const existingTables = new Set(beforeObjects.filter((object) => object.startsWith("table:")).map((object) => object.slice(6)));
    const missingExistingTables = EXISTING_COMMERCIAL_TABLES.filter((table) => !existingTables.has(table));
    const report = {
      action,
      project: "quickiching production",
      existingCommercialTableCount: EXISTING_COMMERCIAL_TABLES.length,
      missingExistingTables,
      migrationHistory: { appliedCount: beforeMigrations.length, state: beforeHistory },
      migration0012Schema: beforeSchema,
      existingCommercialRowCounts: null as Record<string, string> | null,
      after: null as Record<string, unknown> | null,
    };

    if (missingExistingTables.length > 0) {
      console.log(JSON.stringify(report, null, 2));
      throw new Error(`PRODUCTION_SCHEMA_PREREQUISITES_MISSING:${missingExistingTables.join(",")}`);
    }
    if (beforeHistory === "invalid") {
      console.log(JSON.stringify(report, null, 2));
      throw new Error("PRODUCTION_DRIZZLE_HISTORY_DOES_NOT_MATCH_CANDIDATE_MANIFEST");
    }

    if (action === "inspect") {
      console.log(JSON.stringify(report, null, 2));
      if (beforeSchema.state === "partial" || (beforeSchema.state === "complete" && beforeHistory !== "complete")) {
        throw new Error("PRODUCTION_SCHEMA_PARTIAL_OR_UNTRACKED_MIGRATION_0012");
      }
      return;
    }

    if (beforeSchema.state === "partial" || (beforeSchema.state === "complete" && beforeHistory !== "complete")) {
      console.log(JSON.stringify(report, null, 2));
      throw new Error("PRODUCTION_SCHEMA_PARTIAL_OR_UNTRACKED_MIGRATION_0012");
    }
    if (beforeSchema.state === "pending" && beforeHistory !== "pending") {
      console.log(JSON.stringify(report, null, 2));
      throw new Error("PRODUCTION_SCHEMA_MIGRATION_HISTORY_CONFLICT");
    }

    if (beforeSchema.state === "pending" && beforeHistory === "pending") {
      report.existingCommercialRowCounts = await readExistingRowCounts(sql);
      runOfficialDrizzleMigration(databaseUrl);
    }

    const afterObjects = await readSchemaObjects(sql);
    const afterSchema = classifyMigration0012Schema(afterObjects);
    const afterMigrations = await readAppliedMigrations(sql);
    const afterHistory = classifyAppliedMigrationHistory(afterMigrations, EXPECTED_MIGRATIONS);
    const afterRowCounts = report.existingCommercialRowCounts ? await readExistingRowCounts(sql) : null;
    const rowsPreserved = report.existingCommercialRowCounts !== null
      && JSON.stringify(report.existingCommercialRowCounts) === JSON.stringify(afterRowCounts);
    report.after = {
      appliedMigrationCount: afterMigrations.length,
      migrationHistory: afterHistory,
      migration0012Schema: afterSchema,
      existingCommercialTablesCountCompared: Object.keys(report.existingCommercialRowCounts ?? {}).length,
      existingCommercialRowCountsPreserved: report.existingCommercialRowCounts === null ? "not_applicable" : rowsPreserved,
    };
    console.log(JSON.stringify(report, null, 2));
    if (afterSchema.state !== "complete" || afterHistory !== "complete" || (report.existingCommercialRowCounts !== null && !rowsPreserved)) {
      throw new Error("PRODUCTION_DRIZZLE_MIGRATION_POSTCHECK_FAILED");
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "PRODUCTION_SCHEMA_RELEASE_FAILED");
  process.exitCode = 1;
});
