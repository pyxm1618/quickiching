import {
  COMMERCIAL_CAPABILITIES,
  resolveCommercialCapabilities,
  type CommercialCapability,
} from "@/server/capabilities";
import { getCommercialDatabaseConnection } from "@/server/db/client";

export const REQUIRED_COMMERCIAL_TABLES = Object.freeze([
  "users",
  "sessions",
  "accounts",
  "casting_sessions",
  "question_versions",
  "generation_jobs",
  "generation_output_reviews",
  "deep_reading_results",
  "payment_orders",
  "payment_webhook_inbox",
  "payment_outbox",
  "entitlement_batches",
  "entitlement_reservations",
  "entitlement_ledger",
  "workflow_runs",
  "audit_events",
] as const);

// The newest entry in drizzle/meta/_journal.json (0011_cp6_cast_origin).
// A deployment whose applied migration log is empty or older than this has not
// received the CP5 payment/entitlement surface, so it must never report ready.
// readiness-service.test.ts pins this constant to the journal to catch drift.
export const REQUIRED_MIGRATION_CHECKPOINT_AT = 1788070703212;

export type CapabilityReadinessDetail = {
  requested: boolean;
  enabled: boolean;
  status: string;
  missingDependencies: string[];
  invalidDependencies: string[];
  blockedDependencies: string[];
};

export type DatabaseReadinessDetail = {
  status: "ok" | "not_configured" | "error" | "tables_missing" | "migration_missing" | "migration_outdated";
  connected: boolean;
  tablesChecked: boolean;
  missingTables?: string[];
  appliedMigrationAt?: number;
  requiredMigrationAt?: number;
};

export type SystemReadinessReport = {
  status: "ready" | "not_ready";
  overall: "ready" | "blocked";
  database: DatabaseReadinessDetail;
  capabilities: Record<CommercialCapability, CapabilityReadinessDetail>;
};

export async function checkSystemReadiness(
  env: Record<string, string | undefined> = process.env,
  dbOverride?: {
    queryTables?: () => Promise<string[]>;
    queryMigrationTimestamps?: () => Promise<number[]>;
    ping?: () => Promise<void>;
  },
): Promise<SystemReadinessReport> {
  const capabilityConfig = resolveCommercialCapabilities(env);

  const capabilitiesReport = {} as Record<CommercialCapability, CapabilityReadinessDetail>;
  // Commercial V2 is a single commercial surface: checkout without paid deep
  // reading, or auth without generation, is a half-open deployment. Readiness
  // therefore requires every capability, not just the ones that were requested.
  let anyCapabilityUnavailable = false;

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
    if (!status.enabled) {
      anyCapabilityUnavailable = true;
    }
  }

  let dbReport: DatabaseReadinessDetail = {
    status: "not_configured",
    connected: false,
    tablesChecked: false,
  };

  const hasDbUrl = Boolean(env.DATABASE_URL?.trim());

  if (hasDbUrl || dbOverride) {
    try {
      if (dbOverride?.ping) {
        await dbOverride.ping();
      } else {
        const { client } = getCommercialDatabaseConnection(env.DATABASE_URL);
        await client`SELECT 1`;
      }
      dbReport.connected = true;

      let existingTables: string[] = [];
      if (dbOverride?.queryTables) {
        existingTables = await dbOverride.queryTables();
      } else {
        const { client } = getCommercialDatabaseConnection(env.DATABASE_URL);
        const rows = await client<{ table_name: string }[]>`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `;
        existingTables = rows.map((r) => r.table_name);
      }

      dbReport.tablesChecked = true;
      const missing = REQUIRED_COMMERCIAL_TABLES.filter(
        (tbl) => !existingTables.includes(tbl),
      );

      if (missing.length > 0) {
        dbReport.status = "tables_missing";
        dbReport.missingTables = missing;
      } else {
        // Tables can exist while the migration log is behind: a restored
        // snapshot, or a deploy that ran an older migration set. Compare the
        // applied log against the checkpoint before reporting ok.
        let appliedTimestamps: number[];
        if (dbOverride?.queryMigrationTimestamps) {
          appliedTimestamps = await dbOverride.queryMigrationTimestamps();
        } else {
          const { client } = getCommercialDatabaseConnection(env.DATABASE_URL);
          const rows = await client<{ created_at: string | number | null }[]>`
            SELECT created_at FROM drizzle.__drizzle_migrations
          `;
          appliedTimestamps = rows
            .map((row) => Number(row.created_at))
            .filter((value) => Number.isFinite(value));
        }

        dbReport.requiredMigrationAt = REQUIRED_MIGRATION_CHECKPOINT_AT;
        if (appliedTimestamps.length === 0) {
          dbReport.status = "migration_missing";
        } else {
          const latestApplied = Math.max(...appliedTimestamps);
          dbReport.appliedMigrationAt = latestApplied;
          dbReport.status = latestApplied < REQUIRED_MIGRATION_CHECKPOINT_AT
            ? "migration_outdated"
            : "ok";
        }
      }
    } catch {
      dbReport.status = "error";
      dbReport.connected = false;
    }
  }

  const isDatabaseReady = dbReport.status === "ok" && dbReport.connected;

  // Commercial V2 readiness requires:
  // 1. Database is configured, reachable, holds every required commercial
  //    table, and has the CP5 migration checkpoint applied.
  // 2. Every commercial capability is enabled — a partially enabled commercial
  //    surface is not a shippable deployment.
  const overallReady = isDatabaseReady && !anyCapabilityUnavailable;

  return {
    status: overallReady ? "ready" : "not_ready",
    overall: overallReady ? "ready" : "blocked",
    database: dbReport,
    capabilities: capabilitiesReport,
  };
}
