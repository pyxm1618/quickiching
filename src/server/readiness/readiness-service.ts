import {
  COMMERCIAL_CAPABILITIES,
  resolveCommercialCapabilities,
  type CommercialCapability,
} from "@/server/capabilities";
import { getCommercialDatabaseConnection } from "@/server/db/client";
import {
  checkMigrationIntegrity,
  type AppliedMigration,
  type MigrationIntegrityStatus,
} from "./migration-integrity";
import { MIGRATION_0012_REQUIRED_OBJECTS } from "./production-schema-release";

export const REQUIRED_COMMERCIAL_TABLES = Object.freeze([
  "users",
  "sessions",
  "accounts",
  "verifications",
  "login_intents",
  "casting_sessions",
  "question_versions",
  "cast_results",
  "generation_jobs",
  "generation_attempts",
  "preview_results",
  "generation_output_reviews",
  "deep_reading_results",
  "payment_orders",
  "payment_webhook_inbox",
  "payment_outbox",
  "entitlement_batches",
  "entitlement_ledger",
  "entitlement_reservations",
  "payment_checkout_budgets",
  "payment_financial_reviews",
  "payment_webhook_conflicts",
  "workflow_runs",
  "audit_events",
  "question_locks",
  "deep_reading_context_snapshots",
] as const);

export const REQUIRED_COMMERCIAL_SCHEMA_OBJECTS = Object.freeze(
  MIGRATION_0012_REQUIRED_OBJECTS.filter((object) => !object.startsWith("table:")),
);

export type CapabilityReadinessDetail = {
  requested: boolean;
  enabled: boolean;
  status: string;
  missingDependencies: string[];
  invalidDependencies: string[];
  blockedDependencies: string[];
};

export type DatabaseReadinessStatus =
  | "ok"
  | "not_configured"
  | "error"
  | "tables_missing"
  | "schema_objects_missing"
  | Exclude<MigrationIntegrityStatus, "ok">;

export type DatabaseReadinessDetail = {
  status: DatabaseReadinessStatus;
  connected: boolean;
  tablesChecked: boolean;
  migrationsChecked: boolean;
  missingTables?: string[];
  missingSchemaObjects?: string[];
  appliedMigrationCount?: number;
};

export type SystemReadinessReport = {
  status: "ready" | "not_ready";
  overall: "ready" | "blocked";
  database: DatabaseReadinessDetail;
  capabilities: Record<CommercialCapability, CapabilityReadinessDetail>;
};

type ReadinessDbOverride = {
  queryTables?: () => Promise<string[]>;
  querySchemaObjects?: () => Promise<string[]>;
  queryMigrations?: () => Promise<AppliedMigration[]>;
  ping?: () => Promise<void>;
};

export async function checkSystemReadiness(
  env: Record<string, string | undefined> = process.env,
  dbOverride?: ReadinessDbOverride,
): Promise<SystemReadinessReport> {
  const capabilityConfig = resolveCommercialCapabilities(env, {
    production: env.NODE_ENV === "production",
  });

  const capabilitiesReport = {} as Record<CommercialCapability, CapabilityReadinessDetail>;
  let allCommercialCapabilitiesReady = true;

  for (const cap of COMMERCIAL_CAPABILITIES) {
    const status = capabilityConfig.capabilities[cap];
    capabilitiesReport[cap] = {
      requested: status.requested,
      enabled: status.enabled,
      status: status.reason,
      missingDependencies: [...status.missingDependencies],
      invalidDependencies: [...status.invalidDependencies],
      blockedDependencies: [...status.blockedDependencies],
    };
    if (!status.requested || !status.enabled) {
      allCommercialCapabilitiesReady = false;
    }
  }

  let dbReport: DatabaseReadinessDetail = {
    status: "not_configured",
    connected: false,
    tablesChecked: false,
    migrationsChecked: false,
  };

  const hasDbUrl = Boolean(env.DATABASE_URL?.trim());

  if (hasDbUrl || dbOverride) {
    try {
      const connection = dbOverride ? null : getCommercialDatabaseConnection(env.DATABASE_URL);

      if (dbOverride?.ping) {
        await dbOverride.ping();
      } else {
        await connection!.client`SELECT 1`;
      }
      dbReport.connected = true;

      let existingTables: string[];
      if (dbOverride?.queryTables) {
        existingTables = await dbOverride.queryTables();
      } else {
        const rows = await connection!.client<{ table_name: string }[]>`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
        `;
        existingTables = rows.map((row) => row.table_name);
      }

      dbReport.tablesChecked = true;
      const missing = REQUIRED_COMMERCIAL_TABLES.filter(
        (table) => !existingTables.includes(table),
      );

      if (missing.length > 0) {
        dbReport.status = "tables_missing";
        dbReport.missingTables = missing;
      } else {
        let existingSchemaObjects: string[];
        if (dbOverride?.querySchemaObjects) {
          existingSchemaObjects = await dbOverride.querySchemaObjects();
        } else {
          const rows = await connection!.client<{ object_name: string }[]>`
            SELECT object_name FROM (
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
          existingSchemaObjects = rows.map((row) => row.object_name);
        }

        const missingSchemaObjects = REQUIRED_COMMERCIAL_SCHEMA_OBJECTS.filter(
          (object) => !existingSchemaObjects.includes(object),
        );

        if (missingSchemaObjects.length > 0) {
          dbReport.status = "schema_objects_missing";
          dbReport.missingSchemaObjects = [...missingSchemaObjects];
        } else {
          let appliedMigrations: AppliedMigration[];
          if (dbOverride?.queryMigrations) {
            appliedMigrations = await dbOverride.queryMigrations();
          } else {
            const rows = await connection!.client<
              { hash: string; created_at: string | number | bigint }[]
            >`
              SELECT hash, created_at
              FROM drizzle.__drizzle_migrations
              ORDER BY id ASC
            `;
            appliedMigrations = rows.map((row) => ({
              createdAt: Number(row.created_at),
              hash: row.hash,
            }));
          }

          dbReport.migrationsChecked = true;
          dbReport.appliedMigrationCount = appliedMigrations.length;
          dbReport.status = checkMigrationIntegrity(appliedMigrations);
        }
      }
    } catch {
      dbReport = {
        status: "error",
        connected: false,
        tablesChecked: dbReport.tablesChecked,
        migrationsChecked: dbReport.migrationsChecked,
      };
    }
  }

  const isDatabaseReady = dbReport.status === "ok" && dbReport.connected;
  const overallReady = allCommercialCapabilitiesReady && isDatabaseReady;

  return {
    status: overallReady ? "ready" : "not_ready",
    overall: overallReady ? "ready" : "blocked",
    database: dbReport,
    capabilities: capabilitiesReport,
  };
}
