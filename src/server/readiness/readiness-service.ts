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
] as const);

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
  | Exclude<MigrationIntegrityStatus, "ok">;

export type DatabaseReadinessDetail = {
  status: DatabaseReadinessStatus;
  connected: boolean;
  tablesChecked: boolean;
  migrationsChecked: boolean;
  missingTables?: string[];
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
  queryMigrations?: () => Promise<AppliedMigration[]>;
  ping?: () => Promise<void>;
};

export async function checkSystemReadiness(
  env: Record<string, string | undefined> = process.env,
  dbOverride?: ReadinessDbOverride,
): Promise<SystemReadinessReport> {
  const capabilityConfig = resolveCommercialCapabilities(env);

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
