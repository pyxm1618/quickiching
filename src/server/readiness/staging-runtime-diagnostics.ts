import postgres from "postgres";
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
  presentCp5OwnedTypes?: string[];
  presentCp5OwnedFunctions?: string[];
  presentCp5OwnedTriggers?: string[];
};

type DiagnosticDbOverride = {
  ping: () => Promise<void>;
  queryTables: () => Promise<string[]>;
  queryMigrationTablePresent: () => Promise<boolean>;
  queryMigrations: () => Promise<AppliedMigration[]>;
  queryCurrentDatabase?: () => Promise<string>;
  queryCp5OwnedTypes?: () => Promise<string[]>;
  queryCp5OwnedFunctions?: () => Promise<string[]>;
  queryCp5OwnedTriggers?: () => Promise<string[]>;
};

type CapabilityDiagnostic = {
  requested: boolean;
  enabled: boolean;
  reason: string;
  missingDependencies: string[];
  invalidDependencies: string[];
  blockedDependencies: string[];
};

export type MigrationConnectionErrorCategory =
  | "configuration_missing"
  | "network_unreachable"
  | "connection_refused"
  | "connection_timeout"
  | "dns_failure"
  | "authentication_failed"
  | "permission_denied"
  | "database_unavailable"
  | "connection_failed"
  | "tls_failure"
  | "unknown";

export type MigrationConnectionErrorDiagnostic = {
  category: MigrationConnectionErrorCategory;
  code: string | null;
};

export type StagingMigrationConnectionDiagnostic = {
  source: "MIGRATION_DATABASE_URL" | "DATABASE_URL_UNPOOLED" | "missing";
  connected: boolean;
  sameLogicalDatabase: boolean | null;
  migrationHistoryMatchesRuntime: boolean | null;
  schemaCreatePrivilege: boolean | null;
  requiredReferencesPrivilege: boolean | null;
  generationReviewTriggerPrivilege: boolean | null;
  error: MigrationConnectionErrorDiagnostic | null;
};

type MigrationProbeContext = {
  env: Record<string, string | undefined>;
  runtimeDatabaseName: string | null;
  runtimeMigrations: AppliedMigration[];
};

type MigrationConnectionProbe = (
  context: MigrationProbeContext,
) => Promise<StagingMigrationConnectionDiagnostic>;

export type StagingRuntimeDiagnostics = {
  database: StagingRuntimeDatabaseSnapshot & {
    classification: StagingRuntimeDatabaseClassification;
  };
  migrationConnection: StagingMigrationConnectionDiagnostic;
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
    const cp5OwnedObjectsEntirelyAbsent =
      (snapshot.presentCp5OwnedTypes?.length ?? 0) === 0 &&
      (snapshot.presentCp5OwnedFunctions?.length ?? 0) === 0 &&
      (snapshot.presentCp5OwnedTriggers?.length ?? 0) === 0;
    const onlyCp5CoreTablesMissing =
      snapshot.missingTables.length === CP5_CORE_TABLES.length &&
      snapshot.missingTables.every((table) =>
        (CP5_CORE_TABLES as readonly string[]).includes(table),
      );
    if (
      exactlyCp5CoreAndAuditMigrationsPending &&
      cp5CoreEntirelyAbsent &&
      cp5OwnedObjectsEntirelyAbsent &&
      onlyCp5CoreTablesMissing
    ) {
      return "migration_apply_required";
    }

    return "schema_drift_forward_repair_required";
  }
  return "blocked_migration_integrity";
}

const SAFE_MIGRATION_ERROR_CODES = new Map<string, MigrationConnectionErrorCategory>([
  ["ENETUNREACH", "network_unreachable"],
  ["ECONNREFUSED", "connection_refused"],
  ["ETIMEDOUT", "connection_timeout"],
  ["CONNECT_TIMEOUT", "connection_timeout"],
  ["ENOTFOUND", "dns_failure"],
  ["EAI_AGAIN", "dns_failure"],
  ["28P01", "authentication_failed"],
  ["28000", "authentication_failed"],
  ["42501", "permission_denied"],
  ["3D000", "database_unavailable"],
  ["08001", "connection_failed"],
  ["08006", "connection_failed"],
  ["SELF_SIGNED_CERT_IN_CHAIN", "tls_failure"],
  ["CERT_HAS_EXPIRED", "tls_failure"],
  ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "tls_failure"],
]);

export function classifyMigrationConnectionError(
  error: unknown,
): MigrationConnectionErrorDiagnostic {
  const rawCode =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  const code = typeof rawCode === "string" ? rawCode : null;
  const category = code ? SAFE_MIGRATION_ERROR_CODES.get(code) : undefined;
  return category
    ? { category, code }
    : { category: "unknown", code: null };
}

function sameMigrationHistory(left: AppliedMigration[], right: AppliedMigration[]): boolean {
  return left.length === right.length && left.every((migration, index) => {
    const candidate = right[index];
    return Boolean(
      candidate &&
      migration.hash === candidate.hash &&
      migration.createdAt === candidate.createdAt
    );
  });
}

function resolveMigrationConnection(
  env: Record<string, string | undefined>,
): { source: "MIGRATION_DATABASE_URL" | "DATABASE_URL_UNPOOLED" | "missing"; url: string | null } {
  const dedicated = env.MIGRATION_DATABASE_URL?.trim();
  if (dedicated) return { source: "MIGRATION_DATABASE_URL", url: dedicated };
  const unpooled = env.DATABASE_URL_UNPOOLED?.trim();
  if (unpooled) return { source: "DATABASE_URL_UNPOOLED", url: unpooled };
  return { source: "missing", url: null };
}

async function defaultMigrationConnectionProbe({
  env,
  runtimeDatabaseName,
  runtimeMigrations,
}: MigrationProbeContext): Promise<StagingMigrationConnectionDiagnostic> {
  const resolved = resolveMigrationConnection(env);
  if (!resolved.url) {
    return {
      source: resolved.source,
      connected: false,
      sameLogicalDatabase: null,
      migrationHistoryMatchesRuntime: null,
      schemaCreatePrivilege: null,
      requiredReferencesPrivilege: null,
      generationReviewTriggerPrivilege: null,
      error: { category: "configuration_missing", code: null },
    };
  }

  const client = postgres(resolved.url, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 5,
  });
  try {
    const identityRows = await client<{ database_name: string }[]>`
      SELECT current_database() AS database_name
    `;
    const migrationTableRows = await client<{ migration_table: string | null }[]>`
      SELECT to_regclass('drizzle.__drizzle_migrations')::text AS migration_table
    `;
    const migrationTablePresent = Boolean(migrationTableRows[0]?.migration_table);
    const migrationRows = migrationTablePresent
      ? await client<{ hash: string; created_at: string | number | bigint }[]>`
          SELECT hash, created_at
          FROM drizzle.__drizzle_migrations
          ORDER BY id ASC
        `
      : [];
    const migrationMigrations = migrationRows.map((row) => ({
      createdAt: Number(row.created_at),
      hash: row.hash,
    }));
    const migrationHistoryMatchesRuntime = sameMigrationHistory(
      runtimeMigrations,
      migrationMigrations,
    );
    const migrationDatabaseName = identityRows[0]?.database_name ?? null;
    const sameLogicalDatabase =
      runtimeDatabaseName !== null &&
      migrationDatabaseName !== null &&
      runtimeDatabaseName === migrationDatabaseName &&
      migrationHistoryMatchesRuntime;

    const schemaRows = await client<{ allowed: boolean }[]>`
      SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS allowed
    `;
    const referenceRows = await client<{ allowed: boolean }[]>`
      SELECT
        CASE WHEN to_regclass('public.users') IS NULL THEN false
          ELSE has_table_privilege(current_user, 'public.users', 'REFERENCES') END
        AND CASE WHEN to_regclass('public.entitlement_batches') IS NULL THEN false
          ELSE has_table_privilege(current_user, 'public.entitlement_batches', 'REFERENCES') END
        AND CASE WHEN to_regclass('public.casting_sessions') IS NULL THEN false
          ELSE has_table_privilege(current_user, 'public.casting_sessions', 'REFERENCES') END
        AND CASE WHEN to_regclass('public.generation_jobs') IS NULL THEN false
          ELSE has_table_privilege(current_user, 'public.generation_jobs', 'REFERENCES') END
        AS allowed
    `;
    const triggerRows = await client<{ allowed: boolean }[]>`
      SELECT CASE WHEN to_regclass('public.generation_output_reviews') IS NULL THEN false
        ELSE has_table_privilege(current_user, 'public.generation_output_reviews', 'TRIGGER') END AS allowed
    `;

    return {
      source: resolved.source,
      connected: true,
      sameLogicalDatabase,
      migrationHistoryMatchesRuntime,
      schemaCreatePrivilege: Boolean(schemaRows[0]?.allowed),
      requiredReferencesPrivilege: Boolean(referenceRows[0]?.allowed),
      generationReviewTriggerPrivilege: Boolean(triggerRows[0]?.allowed),
      error: null,
    };
  } catch (error) {
    return {
      source: resolved.source,
      connected: false,
      sameLogicalDatabase: null,
      migrationHistoryMatchesRuntime: null,
      schemaCreatePrivilege: null,
      requiredReferencesPrivilege: null,
      generationReviewTriggerPrivilege: null,
      error: classifyMigrationConnectionError(error),
    };
  } finally {
    try {
      await client.end({ timeout: 1 });
    } catch {
      // Diagnostics must not turn a connection-close failure into secret-bearing output.
    }
  }
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
    queryCurrentDatabase: async () => {
      const rows = await connection.client<{ database_name: string }[]>`
        SELECT current_database() AS database_name
      `;
      const databaseName = rows[0]?.database_name;
      if (!databaseName) throw new Error("STAGING_DATABASE_IDENTITY_UNAVAILABLE");
      return databaseName;
    },
    queryCp5OwnedTypes: async () => {
      const rows = await connection.client<{ name: string }[]>`
        SELECT t.typname AS name
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname IN (
            'audit_category',
            'entitlement_reservation_status',
            'workflow_run_status'
          )
        ORDER BY t.typname
      `;
      return rows.map((row) => row.name);
    },
    queryCp5OwnedFunctions: async () => {
      const rows = await connection.client<{ name: string }[]>`
        SELECT p.proname AS name
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'validate_entitlement_reservation_ownership',
            'validate_deep_reading_results_insertion',
            'prevent_audit_events_mutation',
            'prevent_deep_reading_results_mutation'
          )
        ORDER BY p.proname
      `;
      return rows.map((row) => row.name);
    },
    queryCp5OwnedTriggers: async () => {
      const rows = await connection.client<{ name: string }[]>`
        SELECT t.tgname AS name
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND NOT t.tgisinternal
          AND t.tgname IN (
            'entitlement_reservation_ownership_trigger',
            'deep_reading_results_insertion_trigger',
            'audit_events_immutable_trigger',
            'deep_reading_results_immutable_trigger'
          )
        ORDER BY t.tgname
      `;
      return rows.map((row) => row.name);
    },
  };
}

export async function collectStagingRuntimeDiagnostics(
  env: Record<string, string | undefined> = process.env,
  dbOverride?: DiagnosticDbOverride,
  migrationProbe: MigrationConnectionProbe = defaultMigrationConnectionProbe,
): Promise<StagingRuntimeDiagnostics> {
  const db = dbOverride ?? await defaultDbProbe();
  await db.ping();
  const tableNames = await db.queryTables();
  const tableSet = new Set(tableNames);
  const migrationTablePresent = await db.queryMigrationTablePresent();
  const appliedMigrations = migrationTablePresent ? await db.queryMigrations() : [];
  const runtimeDatabaseName = db.queryCurrentDatabase ? await db.queryCurrentDatabase() : null;
  const presentCp5OwnedTypes = db.queryCp5OwnedTypes ? await db.queryCp5OwnedTypes() : [];
  const presentCp5OwnedFunctions = db.queryCp5OwnedFunctions ? await db.queryCp5OwnedFunctions() : [];
  const presentCp5OwnedTriggers = db.queryCp5OwnedTriggers ? await db.queryCp5OwnedTriggers() : [];

  const database: StagingRuntimeDatabaseSnapshot = {
    connected: true,
    migrationTablePresent,
    migrationStatus: checkMigrationIntegrity(appliedMigrations),
    appliedMigrationCount: appliedMigrations.length,
    expectedMigrationCount: EXPECTED_COMMERCIAL_MIGRATIONS.length,
    missingTables: REQUIRED_COMMERCIAL_TABLES.filter((table) => !tableSet.has(table)),
    presentCp5CoreTables: CP5_CORE_TABLES.filter((table) => tableSet.has(table)),
    presentCp5OwnedTypes,
    presentCp5OwnedFunctions,
    presentCp5OwnedTriggers,
  };

  const migrationConnection = await migrationProbe({
    env,
    runtimeDatabaseName,
    runtimeMigrations: appliedMigrations,
  });

  const prerequisiteEnv = { ...env };
  for (const capability of COMMERCIAL_CAPABILITIES) {
    prerequisiteEnv[COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX[capability].flag] = "true";
  }

  return {
    database: {
      ...database,
      classification: classifyStagingRuntimeDatabase(database),
    },
    migrationConnection,
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
