import {
  COMMERCIAL_CAPABILITIES,
  COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX,
  resolveCommercialCapabilities,
  type CommercialCapability,
} from "@/server/capabilities";
import { getCommercialDatabaseConnection } from "@/server/db/client";
import { REQUIRED_COMMERCIAL_TABLES } from "./readiness-service";
import {
  checkMigrationIntegrity,
  EXPECTED_COMMERCIAL_MIGRATIONS,
  type AppliedMigration,
  type MigrationIntegrityStatus,
} from "./migration-integrity";

const STAGING_ORIGIN = "https://staging.quickiching.com";
const CP5_CORE_TABLES = Object.freeze([
  "audit_events",
  "workflow_runs",
  "deep_reading_results",
  "entitlement_reservations",
] as const);

export type StagingRuntimeDatabaseClassification =
  | "ready"
  | "migration_apply_required"
  | "schema_drift_forward_repair_required"
  | "blocked_migration_integrity"
  | "blocked_migration_history";

export type StagingRuntimeDatabaseSnapshot = {
  connected: boolean;
  migrationTablePresent: boolean;
  migrationStatus: MigrationIntegrityStatus;
  appliedMigrationCount: number;
  expectedMigrationCount: number;
  missingTables: string[];
  presentCp5CoreTables: string[];
};

type DiagnosticDbOverride = {
  ping: () => Promise<void>;
  queryTables: () => Promise<string[]>;
  queryMigrationTablePresent: () => Promise<boolean>;
  queryMigrations: () => Promise<AppliedMigration[]>;
};

type CapabilityDiagnostic = {
  requested: boolean;
  enabled: boolean;
  reason: string;
  missingDependencies: string[];
  invalidDependencies: string[];
  blockedDependencies: string[];
};

export type StagingRuntimeDiagnostics = {
  database: StagingRuntimeDatabaseSnapshot & {
    classification: StagingRuntimeDatabaseClassification;
  };
  provider: {
    waffoEnvironmentIsTest: boolean;
    originChecks: {
      appBaseUrl: boolean;
      publicAppUrl: boolean;
      betterAuthUrl: boolean;
    };
  };
  capabilities: {
    actual: Record<CommercialCapability, CapabilityDiagnostic>;
    prerequisitesIfRequested: Record<CommercialCapability, CapabilityDiagnostic>;
  };
};

function sameOrigin(candidate: string | undefined, expected: string): boolean {
  if (!candidate?.trim()) return false;
  try {
    return new URL(candidate).origin === expected;
  } catch {
    return false;
  }
}

function capabilitySnapshot(
  env: Record<string, string | undefined>,
): Record<CommercialCapability, CapabilityDiagnostic> {
  const resolved = resolveCommercialCapabilities(env, { production: true });
  const result = {} as Record<CommercialCapability, CapabilityDiagnostic>;
  for (const capability of COMMERCIAL_CAPABILITIES) {
    const status = resolved.capabilities[capability];
    result[capability] = {
      requested: status.requested,
      enabled: status.enabled,
      reason: status.reason,
      missingDependencies: [...status.missingDependencies],
      invalidDependencies: [...status.invalidDependencies],
      blockedDependencies: [...status.blockedDependencies],
    };
  }
  return result;
}

export function classifyStagingRuntimeDatabase(
  snapshot: StagingRuntimeDatabaseSnapshot,
): StagingRuntimeDatabaseClassification {
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
    const pendingMigrationCount = snapshot.expectedMigrationCount - snapshot.appliedMigrationCount;
    const exactlyFinalMigrationPending = pendingMigrationCount === 1;
    if (exactlyFinalMigrationPending && snapshot.missingTables.length === 0) {
      return "migration_apply_required";
    }

    const exactlyCp5CoreAndAuditMigrationsPending = pendingMigrationCount === 2;
    const cp5CoreEntirelyAbsent = snapshot.presentCp5CoreTables.length === 0;
    const onlyCp5CoreTablesMissing =
      snapshot.missingTables.length === CP5_CORE_TABLES.length &&
      snapshot.missingTables.every((table) =>
        (CP5_CORE_TABLES as readonly string[]).includes(table),
      );
    if (
      exactlyCp5CoreAndAuditMigrationsPending &&
      cp5CoreEntirelyAbsent &&
      onlyCp5CoreTablesMissing
    ) {
      return "migration_apply_required";
    }

    return "schema_drift_forward_repair_required";
  }
  return "blocked_migration_integrity";
}

async function defaultDbProbe(): Promise<DiagnosticDbOverride> {
  const connection = getCommercialDatabaseConnection();
  return {
    ping: async () => {
      await connection.client`SELECT 1`;
    },
    queryTables: async () => {
      const rows = await connection.client<{ table_name: string }[]>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `;
      return rows.map((row) => row.table_name);
    },
    queryMigrationTablePresent: async () => {
      const rows = await connection.client<{ migration_table: string | null }[]>`
        SELECT to_regclass('drizzle.__drizzle_migrations')::text AS migration_table
      `;
      return Boolean(rows[0]?.migration_table);
    },
    queryMigrations: async () => {
      const rows = await connection.client<
        { hash: string; created_at: string | number | bigint }[]
      >`
        SELECT hash, created_at
        FROM drizzle.__drizzle_migrations
        ORDER BY id ASC
      `;
      return rows.map((row) => ({
        createdAt: Number(row.created_at),
        hash: row.hash,
      }));
    },
  };
}

export async function collectStagingRuntimeDiagnostics(
  env: Record<string, string | undefined> = process.env,
  dbOverride?: DiagnosticDbOverride,
): Promise<StagingRuntimeDiagnostics> {
  const db = dbOverride ?? await defaultDbProbe();
  await db.ping();
  const tableNames = await db.queryTables();
  const tableSet = new Set(tableNames);
  const migrationTablePresent = await db.queryMigrationTablePresent();
  const appliedMigrations = migrationTablePresent ? await db.queryMigrations() : [];

  const database: StagingRuntimeDatabaseSnapshot = {
    connected: true,
    migrationTablePresent,
    migrationStatus: checkMigrationIntegrity(appliedMigrations),
    appliedMigrationCount: appliedMigrations.length,
    expectedMigrationCount: EXPECTED_COMMERCIAL_MIGRATIONS.length,
    missingTables: REQUIRED_COMMERCIAL_TABLES.filter((table) => !tableSet.has(table)),
    presentCp5CoreTables: CP5_CORE_TABLES.filter((table) => tableSet.has(table)),
  };

  const prerequisiteEnv = { ...env };
  for (const capability of COMMERCIAL_CAPABILITIES) {
    prerequisiteEnv[COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX[capability].flag] = "true";
  }

  return {
    database: {
      ...database,
      classification: classifyStagingRuntimeDatabase(database),
    },
    provider: {
      waffoEnvironmentIsTest: env.WAFFO_ENVIRONMENT?.trim() === "test",
      originChecks: {
        appBaseUrl: sameOrigin(env.APP_BASE_URL, STAGING_ORIGIN),
        publicAppUrl: sameOrigin(env.NEXT_PUBLIC_APP_URL, STAGING_ORIGIN),
        betterAuthUrl: sameOrigin(env.BETTER_AUTH_URL, STAGING_ORIGIN),
      },
    },
    capabilities: {
      actual: capabilitySnapshot(env),
      prerequisitesIfRequested: capabilitySnapshot(prerequisiteEnv),
    },
  };
}
