import { spawnSync } from "node:child_process";
import postgres from "postgres";
import migrationIntegrity from "../drizzle/migration-integrity.json";
import {
  assessRecoveryPosture,
  classifyAppliedMigrationHistory,
  classifyCurrentSchema,
  classifyProductionMigrationPreflight,
  requireProductionDatabaseUrl,
  resolveProductionDatabaseUrl,
  type ProductionEnvironmentEntry,
  type ProductionSchemaColumn,
  type ProductionSchemaIndex,
} from "../src/server/readiness/production-schema-release";
import { REQUIRED_COMMERCIAL_TABLES } from "../src/server/readiness/readiness-service";

const PRODUCTION_PROJECT_ID = "prj_pCpeoAys2GOqKZvkbLugYjpJWZBS";
const PRODUCTION_TEAM_ID = "team_z1b9TTQtbNkr43dzs5JVJPnQ";
const CURRENT_PRODUCTION_MIGRATION_TAG = "0015_better_auth_1_7_account_identity";
const REFUND_INTEGRITY_TAG = "0014_security_refund_integrity";
const EXPECTED_MIGRATIONS = migrationIntegrity.migrations.map(({ createdAt, hash }) => ({ createdAt, hash }));
const EXPECTED_TAGS = migrationIntegrity.migrations.map((migration) => migration.tag);
const EXISTING_COMMERCIAL_TABLES = [...REQUIRED_COMMERCIAL_TABLES];
const REFUND_INTEGRITY_INDEX = EXPECTED_TAGS.indexOf(REFUND_INTEGRITY_TAG);
const ACCOUNT_IDENTITY_INDEX = EXPECTED_TAGS.indexOf(CURRENT_PRODUCTION_MIGRATION_TAG);

type AppliedMigrationRow = { id: number; createdAt: number; hash: string };
type TargetColumnRow = { table_name: string; column_name: string; is_nullable: "YES" | "NO"; column_default: string | null };
type AccountIndexRow = { indexname: string; indexdef: string; is_valid: boolean };

async function fetchProductionDatabaseUrl(): Promise<string> {
  const releaseSecret = process.env.PRODUCTION_DATABASE_URL;
  if (releaseSecret) return requireProductionDatabaseUrl(releaseSecret);

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

async function readAppliedMigrations(sql: ReturnType<typeof postgres>): Promise<AppliedMigrationRow[]> {
  const rows = await sql<{ id: number; created_at: string | number | bigint; hash: string }[]>`
    SELECT id, created_at, hash FROM drizzle.__drizzle_migrations ORDER BY id ASC
  `;
  return rows.map((row) => ({ id: Number(row.id), createdAt: Number(row.created_at), hash: row.hash }));
}

async function readTargetColumns(sql: ReturnType<typeof postgres>): Promise<ProductionSchemaColumn[]> {
  const rows = await sql<TargetColumnRow[]>`
    SELECT table_name, column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name, column_name) IN (
        ('entitlement_batches', 'refund_locked'),
        ('refund_intents', 'decision_operator_id'),
        ('refund_intents', 'dispatch_operator_id'),
        ('accounts', 'issuer')
      )
    ORDER BY table_name, column_name
  `;
  return rows.map((row) => ({
    table: row.table_name,
    column: row.column_name,
    isNullable: row.is_nullable === "YES",
    columnDefault: row.column_default,
  }));
}

async function readAccountsIndexes(sql: ReturnType<typeof postgres>): Promise<ProductionSchemaIndex[]> {
  const rows = await sql<AccountIndexRow[]>`
    SELECT index_row.relname AS indexname,
           pg_get_indexdef(index_row.oid) AS indexdef,
           index_meta.indisvalid AS is_valid
    FROM pg_index index_meta
    JOIN pg_class index_row ON index_row.oid = index_meta.indexrelid
    JOIN pg_class table_row ON table_row.oid = index_meta.indrelid
    JOIN pg_namespace table_schema ON table_schema.oid = table_row.relnamespace
    WHERE table_schema.nspname = 'public'
      AND table_row.relname = 'accounts'
      AND index_row.relname IN ('accounts_issuer_account_id_idx', 'accounts_provider_account_id_idx')
    ORDER BY index_row.relname
  `;
  return rows.map((row) => ({
    name: row.indexname,
    definition: row.indexdef,
    isValid: Boolean(row.is_valid),
  }));
}

async function readDuplicateAccountIdentities(sql: ReturnType<typeof postgres>): Promise<number> {
  const rows = await sql<{ duplicate_count: number }[]>`
    SELECT count(*)::int AS duplicate_count
    FROM (
      SELECT provider_id, account_id
      FROM accounts
      GROUP BY provider_id, account_id
      HAVING count(*) > 1
    ) AS duplicate_identities
  `;
  return Number(rows[0]?.duplicate_count ?? 0);
}

async function readRefundBackfillCandidates(
  sql: ReturnType<typeof postgres>,
  refundLockedColumnPresent: boolean,
): Promise<number> {
  const rows = refundLockedColumnPresent
    ? await sql<{ candidate_count: number }[]>`
        SELECT count(*)::int AS candidate_count
        FROM entitlement_batches AS b
        JOIN refund_intents AS r ON r.order_id = b.order_id
        WHERE r.provider_write_attempt_count = 1
          AND r.provider_write_state IN ('dispatched', 'confirmed', 'ambiguous')
          AND r.status IN ('processing', 'reconciliation_required')
          AND b.quantity_revoked < b.quantity_total
          AND b.refund_locked = false
      `
    : await sql<{ candidate_count: number }[]>`
        SELECT count(*)::int AS candidate_count
        FROM entitlement_batches AS b
        JOIN refund_intents AS r ON r.order_id = b.order_id
        WHERE r.provider_write_attempt_count = 1
          AND r.provider_write_state IN ('dispatched', 'confirmed', 'ambiguous')
          AND r.status IN ('processing', 'reconciliation_required')
          AND b.quantity_revoked < b.quantity_total
      `;
  return Number(rows[0]?.candidate_count ?? 0);
}

async function readRefundLockedBatches(sql: ReturnType<typeof postgres>): Promise<number | null> {
  const rows = await sql<{ locked_count: number }[]>`
    SELECT count(*)::int AS locked_count
    FROM entitlement_batches
    WHERE refund_locked = true
  `;
  return Number(rows[0]?.locked_count ?? 0);
}

async function readExistingRowCounts(sql: ReturnType<typeof postgres>): Promise<Record<string, string>> {
  const entries = await Promise.all(EXISTING_COMMERCIAL_TABLES.map(async (table) => {
    const identifier = `public."${table.replaceAll('"', '""')}"`;
    const rows = await sql.unsafe(`SELECT count(*)::text AS row_count FROM ${identifier}`) as { row_count: string }[];
    return [table, rows[0]?.row_count ?? "0"] as const;
  }));
  return Object.fromEntries(entries);
}

type ProductionPreflightSnapshot = {
  appliedCount: number;
  refundIntegrityApplied: boolean;
  accountIdentityApplied: boolean;
  targetColumns: ProductionSchemaColumn[];
  accountIndexes: ProductionSchemaIndex[];
  duplicateAccountIdentities: number;
  refundBackfillCandidates: number;
  refundLockedBatches: number | null;
  classification: ReturnType<typeof classifyProductionMigrationPreflight>;
};

async function readProductionPreflight(
  sql: ReturnType<typeof postgres>,
  appliedCount: number,
): Promise<ProductionPreflightSnapshot> {
  const targetColumns = await readTargetColumns(sql);
  const refundLockedColumnPresent = targetColumns.some(
    (column) => column.table === "entitlement_batches" && column.column === "refund_locked",
  );
  const [accountIndexes, duplicateAccountIdentities, refundBackfillCandidates, refundLockedBatches] = await Promise.all([
    readAccountsIndexes(sql),
    readDuplicateAccountIdentities(sql),
    readRefundBackfillCandidates(sql, refundLockedColumnPresent),
    refundLockedColumnPresent ? readRefundLockedBatches(sql) : Promise.resolve(null),
  ]);
  const refundIntegrityApplied = appliedCount > REFUND_INTEGRITY_INDEX;
  const accountIdentityApplied = appliedCount > ACCOUNT_IDENTITY_INDEX;
  const classification = classifyProductionMigrationPreflight({
    refundIntegrityApplied,
    accountIdentityApplied,
    columns: targetColumns,
    indexes: accountIndexes,
    duplicateAccountIdentities,
  });
  return {
    appliedCount,
    refundIntegrityApplied,
    accountIdentityApplied,
    targetColumns,
    accountIndexes,
    duplicateAccountIdentities,
    refundBackfillCandidates,
    refundLockedBatches,
    classification,
  };
}

const MANAGED_BACKUP_PROVIDERS = Object.freeze([
  { suffix: ".neon.tech", label: "neon" },
  { suffix: ".supabase.co", label: "supabase" },
  { suffix: ".supabase.com", label: "supabase" },
  { suffix: ".rds.amazonaws.com", label: "aws-rds" },
  { suffix: ".render.com", label: "render" },
  { suffix: ".railway.app", label: "railway" },
  { suffix: ".aivencloud.com", label: "aiven" },
  { suffix: ".cockroachlabs.cloud", label: "cockroachdb-cloud" },
  { suffix: ".vercel-storage.com", label: "vercel-postgres" },
  { suffix: ".ondigitalocean.com", label: "digitalocean-managed" },
  { suffix: ".timescale.com", label: "timescale-cloud" },
] as const);

type RecoveryPosture = {
  provider: string;
  managedBackupProvider: boolean;
  serverVersionNum: number | null;
  archiveMode: string | null;
  walLevel: string | null;
  inRecovery: boolean | null;
  walArchivingObserved: boolean | null;
  recoveryConfirmed: boolean;
  recoveryEvidence: ReturnType<typeof assessRecoveryPosture>["recoveryEvidence"];
  restoreVerified: false;
};

function detectDatabaseProvider(databaseUrl: string): { label: string; managed: boolean } {
  let host = "";
  try {
    host = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    return { label: "unparseable-connection", managed: false };
  }
  const match = MANAGED_BACKUP_PROVIDERS.find(
    (candidate) => host === candidate.suffix.slice(1) || host.endsWith(candidate.suffix),
  );
  return match ? { label: match.label, managed: true } : { label: "self-hosted-or-unrecognized", managed: false };
}

async function readRecoveryPosture(
  sql: ReturnType<typeof postgres>,
  databaseUrl: string,
): Promise<RecoveryPosture> {
  const provider = detectDatabaseProvider(databaseUrl);
  let settings: { server_version_num?: unknown; archive_mode?: unknown; wal_level?: unknown; in_recovery?: unknown } | undefined;
  try {
    [settings] = await sql`
      SELECT current_setting('server_version_num') AS server_version_num,
             current_setting('archive_mode') AS archive_mode,
             current_setting('wal_level') AS wal_level,
             pg_is_in_recovery() AS in_recovery
    `;
  } catch {
    settings = undefined;
  }
  let walArchivingObserved: boolean | null = null;
  try {
    const [archiver] = await sql<{ archived_count: number }[]>`
      SELECT count(*)::int AS archived_count
      FROM pg_stat_archiver
      WHERE last_archived_time IS NOT NULL
    `;
    walArchivingObserved = Number(archiver?.archived_count ?? 0) > 0;
  } catch {
    walArchivingObserved = null;
  }
  const serverVersionNum = Number.isFinite(Number(settings?.server_version_num))
    ? Number(settings?.server_version_num)
    : null;
  const archiveMode = typeof settings?.archive_mode === "string" ? settings.archive_mode : null;
  const assessment = assessRecoveryPosture({
    managedBackupProvider: provider.managed,
    archiveMode,
    walArchivingObserved,
  });
  return {
    provider: provider.label,
    managedBackupProvider: provider.managed,
    serverVersionNum,
    archiveMode,
    walLevel: typeof settings?.wal_level === "string" ? settings.wal_level : null,
    inRecovery: typeof settings?.in_recovery === "boolean" ? settings.in_recovery : null,
    walArchivingObserved,
    recoveryConfirmed: assessment.recoveryConfirmed,
    recoveryEvidence: assessment.recoveryEvidence,
    restoreVerified: false,
  };
}

function migrationHistoryView(applied: readonly AppliedMigrationRow[]) {
  return applied.map((migration, index) => ({
    id: migration.id,
    tag: EXPECTED_TAGS[index] ?? null,
    createdAt: migration.createdAt,
    hash: migration.hash,
  }));
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
  if (
    EXPECTED_MIGRATIONS.length !== 16
    || EXPECTED_TAGS[15] !== CURRENT_PRODUCTION_MIGRATION_TAG
    || REFUND_INTEGRITY_INDEX !== 14
    || ACCOUNT_IDENTITY_INDEX !== 15
  ) {
    throw new Error("EXPECTED_PRODUCTION_MIGRATION_0015_NOT_CURRENT");
  }

  const databaseUrl = await fetchProductionDatabaseUrl();
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10 });
  try {
    const beforeObjects = await readSchemaObjects(sql);
    const beforeSchema = classifyCurrentSchema(beforeObjects);
    const beforeMigrations = await readAppliedMigrations(sql);
    const beforeHistory = classifyAppliedMigrationHistory(beforeMigrations, EXPECTED_MIGRATIONS);
    const beforePreflight = await readProductionPreflight(sql, beforeMigrations.length);
    const recoveryPosture = await readRecoveryPosture(sql, databaseUrl);
    const existingTables = new Set(beforeObjects.filter((object) => object.startsWith("table:")).map((object) => object.slice(6)));
    const missingExistingTables = EXISTING_COMMERCIAL_TABLES.filter((table) => !existingTables.has(table));
    const pendingTags = EXPECTED_TAGS.slice(beforeMigrations.length);
    const report = {
      action,
      project: "quickiching production",
      existingCommercialTableCount: EXISTING_COMMERCIAL_TABLES.length,
      missingExistingTables,
      recoveryPosture,
      migrationHistory: {
        appliedCount: beforeMigrations.length,
        expectedCount: EXPECTED_MIGRATIONS.length,
        state: beforeHistory,
        pendingTags,
        applied: migrationHistoryView(beforeMigrations),
      },
      currentSchema: beforeSchema,
      productionPreflight: beforePreflight,
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
    if (beforeSchema.state === "partial") {
      console.log(JSON.stringify(report, null, 2));
      throw new Error("PRODUCTION_SCHEMA_PARTIAL_OR_UNTRACKED_MIGRATION");
    }
    if (beforePreflight.classification.state !== "ready") {
      console.log(JSON.stringify(report, null, 2));
      throw new Error(`PRODUCTION_SCHEMA_PREFLIGHT_FAILED:${beforePreflight.classification.issues.join(",")}`);
    }

    if (action === "inspect") {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    if (pendingTags.length > 0) {
      if (!recoveryPosture.recoveryConfirmed) {
        console.log(JSON.stringify(report, null, 2));
        throw new Error(`PRODUCTION_RECOVERY_CAPABILITY_UNCONFIRMED:${recoveryPosture.recoveryEvidence}`);
      }
      report.existingCommercialRowCounts = await readExistingRowCounts(sql);
      const refresh = await readProductionPreflight(sql, beforeMigrations.length);
      if (refresh.classification.state !== "ready") {
        throw new Error(`PRODUCTION_SCHEMA_PREFLIGHT_FAILED:${refresh.classification.issues.join(",")}`);
      }
      runOfficialDrizzleMigration(databaseUrl);
    }

    const afterObjects = await readSchemaObjects(sql);
    const afterSchema = classifyCurrentSchema(afterObjects);
    const afterMigrations = await readAppliedMigrations(sql);
    const afterHistory = classifyAppliedMigrationHistory(afterMigrations, EXPECTED_MIGRATIONS);
    const afterPreflight = await readProductionPreflight(sql, afterMigrations.length);
    const afterRowCounts = report.existingCommercialRowCounts ? await readExistingRowCounts(sql) : null;
    const rowsPreserved = report.existingCommercialRowCounts !== null
      && JSON.stringify(report.existingCommercialRowCounts) === JSON.stringify(afterRowCounts);
    report.after = {
      appliedMigrationCount: afterMigrations.length,
      migrationHistory: afterHistory,
      currentSchema: afterSchema,
      productionPreflight: afterPreflight,
      remainingUnlockedRefundCandidates: afterPreflight.refundBackfillCandidates,
      existingCommercialTablesCountCompared: Object.keys(report.existingCommercialRowCounts ?? {}).length,
      existingCommercialRowCountsPreserved: report.existingCommercialRowCounts === null ? "not_applicable" : rowsPreserved,
    };
    console.log(JSON.stringify(report, null, 2));
    if (
      afterMigrations.length !== EXPECTED_MIGRATIONS.length
      || afterHistory !== "complete"
      || afterSchema.state !== "complete"
      || afterPreflight.classification.state !== "ready"
      || afterPreflight.refundBackfillCandidates !== 0
      || (report.existingCommercialRowCounts !== null && !rowsPreserved)
    ) {
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
