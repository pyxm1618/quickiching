import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postgres from "postgres";
import {
  COMMERCIAL_CAPABILITIES,
  COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX,
  resolveCommercialCapabilities,
} from "../src/server/capabilities";
import { REQUIRED_COMMERCIAL_TABLES } from "../src/server/readiness/readiness-service";
import {
  checkMigrationIntegrity,
  EXPECTED_COMMERCIAL_MIGRATIONS,
  type AppliedMigration,
  type MigrationIntegrityStatus,
} from "../src/server/readiness/migration-integrity";

const STAGING_ORIGIN = "https://staging.quickiching.com";
const CP5_CORE_TABLES = Object.freeze([
  "audit_events",
  "workflow_runs",
  "deep_reading_results",
  "entitlement_reservations",
] as const);

export type StagingDatabaseClassification =
  | "ready"
  | "migration_apply_required"
  | "schema_drift_forward_repair_required"
  | "blocked_migration_integrity"
  | "blocked_migration_history";

export type StagingDatabaseSnapshot = {
  migrationTablePresent: boolean;
  migrationStatus: MigrationIntegrityStatus;
  appliedMigrationCount: number;
  expectedMigrationCount: number;
  missingTables: string[];
  presentCp5CoreTables: string[];
};

type CapabilityPreflight = {
  ok: boolean;
  waffoEnvironment: "test" | "invalid";
  originChecks: Record<"APP_BASE_URL" | "NEXT_PUBLIC_APP_URL" | "BETTER_AUTH_URL", boolean>;
  capabilities: Record<string, {
    enabled: boolean;
    reason: string;
    missingDependencies: string[];
    invalidDependencies: string[];
    blockedDependencies: string[];
  }>;
};

function originMatches(candidate: string | undefined): boolean {
  if (!candidate?.trim()) return false;
  try {
    return new URL(candidate).origin === STAGING_ORIGIN;
  } catch {
    return false;
  }
}

export function inspectStagingCapabilityConfiguration(
  sourceEnv: Record<string, string | undefined>,
  requireFlagsEnabled = false,
): CapabilityPreflight {
  const env = { ...sourceEnv };
  if (!requireFlagsEnabled) {
    for (const capability of COMMERCIAL_CAPABILITIES) {
      env[COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX[capability].flag] = "true";
    }
  }

  const resolved = resolveCommercialCapabilities(env, { production: true });
  const capabilities: CapabilityPreflight["capabilities"] = {};
  let allEnabled = true;
  for (const capability of COMMERCIAL_CAPABILITIES) {
    const status = resolved.capabilities[capability];
    capabilities[capability] = {
      enabled: status.enabled,
      reason: status.reason,
      missingDependencies: [...status.missingDependencies],
      invalidDependencies: [...status.invalidDependencies],
      blockedDependencies: [...status.blockedDependencies],
    };
    if (!status.enabled) allEnabled = false;
  }

  const originChecks = {
    APP_BASE_URL: originMatches(env.APP_BASE_URL),
    NEXT_PUBLIC_APP_URL: originMatches(env.NEXT_PUBLIC_APP_URL),
    BETTER_AUTH_URL: originMatches(env.BETTER_AUTH_URL),
  };
  const originsValid = Object.values(originChecks).every(Boolean);
  const waffoEnvironment = env.WAFFO_ENVIRONMENT?.trim() === "test" ? "test" : "invalid";

  return {
    ok: allEnabled && originsValid && waffoEnvironment === "test",
    waffoEnvironment,
    originChecks,
    capabilities,
  };
}

export function classifyStagingDatabase(snapshot: StagingDatabaseSnapshot): StagingDatabaseClassification {
  if (!snapshot.migrationTablePresent || snapshot.migrationStatus === "migration_missing") {
    return "blocked_migration_history";
  }
  if (
    snapshot.migrationStatus === "migration_hash_mismatch" ||
    snapshot.migrationStatus === "migration_sequence_invalid"
  ) {
    return "blocked_migration_integrity";
  }
  if (snapshot.migrationStatus === "ok") {
    return snapshot.missingTables.length === 0
      ? "ready"
      : "schema_drift_forward_repair_required";
  }
  if (snapshot.migrationStatus === "migration_outdated") {
    const onlyFinalMigrationPending =
      snapshot.appliedMigrationCount === snapshot.expectedMigrationCount - 1;
    if (onlyFinalMigrationPending && snapshot.missingTables.length === 0) {
      return "migration_apply_required";
    }
    return "schema_drift_forward_repair_required";
  }
  return "blocked_migration_integrity";
}

async function inspectDatabase(databaseUrl: string): Promise<StagingDatabaseSnapshot> {
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 2,
  });

  try {
    const tableRows = await sql<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    const tableNames = new Set(tableRows.map((row) => row.table_name));

    const regclassRows = await sql<{ migration_table: string | null }[]>`
      SELECT to_regclass('drizzle.__drizzle_migrations')::text AS migration_table
    `;
    const migrationTablePresent = Boolean(regclassRows[0]?.migration_table);

    let applied: AppliedMigration[] = [];
    if (migrationTablePresent) {
      const migrationRows = await sql<{ hash: string; created_at: string | number | bigint }[]>`
        SELECT hash, created_at
        FROM drizzle.__drizzle_migrations
        ORDER BY id ASC
      `;
      applied = migrationRows.map((row) => ({
        hash: row.hash,
        createdAt: Number(row.created_at),
      }));
    }

    return {
      migrationTablePresent,
      migrationStatus: checkMigrationIntegrity(applied),
      appliedMigrationCount: applied.length,
      expectedMigrationCount: EXPECTED_COMMERCIAL_MIGRATIONS.length,
      missingTables: REQUIRED_COMMERCIAL_TABLES.filter((table) => !tableNames.has(table)),
      presentCp5CoreTables: CP5_CORE_TABLES.filter((table) => tableNames.has(table)),
    };
  } finally {
    await sql.end({ timeout: 2 });
  }
}

function runMigration(): void {
  const result = spawnSync("bun", ["run", "db:migrate"], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`STAGING_MIGRATION_FAILED:${String(result.status)}`);
  }
}

async function main(): Promise<void> {
  const requireFlagsEnabled = process.argv.includes("--require-flags-enabled");
  const applyPendingMigration = process.argv.includes("--apply-pending-migration");
  const capability = inspectStagingCapabilityConfiguration(process.env, requireFlagsEnabled);

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.log(JSON.stringify({ capability, database: { error: "DATABASE_URL_MISSING" } }, null, 2));
    process.exitCode = 2;
    return;
  }

  let database = await inspectDatabase(databaseUrl);
  let classification = classifyStagingDatabase(database);

  console.log(JSON.stringify({ capability, database, classification }, null, 2));

  if (!capability.ok) {
    process.exitCode = 3;
    return;
  }

  if (applyPendingMigration) {
    if (classification !== "migration_apply_required") {
      if (classification !== "ready") process.exitCode = 4;
      return;
    }

    // This path is intentionally limited to exactly one final pending migration
    // and a complete required-table set. Historical or partial schema drift is
    // never replayed automatically; it requires a new forward-only repair.
    runMigration();
    database = await inspectDatabase(databaseUrl);
    classification = classifyStagingDatabase(database);
    console.log(JSON.stringify({ postMigration: database, classification }, null, 2));
  }

  if (classification !== "ready") process.exitCode = 4;
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entry && fileURLToPath(import.meta.url) === entry) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "UNKNOWN_PREFLIGHT_ERROR";
    console.error(`CP6_STAGING_PREFLIGHT_FAILED:${message}`);
    process.exitCode = 1;
  });
}
