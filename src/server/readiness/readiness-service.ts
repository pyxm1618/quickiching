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
  "payment_orders",
  "payment_webhook_inbox",
  "entitlement_ledger",
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

export type DatabaseReadinessDetail = {
  status: "ok" | "not_configured" | "error" | "tables_missing";
  connected: boolean;
  tablesChecked: boolean;
  missingTables?: string[];
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
    ping?: () => Promise<void>;
  },
): Promise<SystemReadinessReport> {
  const capabilityConfig = resolveCommercialCapabilities(env);

  const capabilitiesReport = {} as Record<CommercialCapability, CapabilityReadinessDetail>;
  let anyRequestedBlocked = false;

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
    if (status.requested && !status.enabled) {
      anyRequestedBlocked = true;
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
        dbReport.status = "ok";
      }
    } catch {
      dbReport.status = "error";
      dbReport.connected = false;
    }
  }

  const isDatabaseBlocking =
    capabilityConfig.commercialEnabled &&
    (dbReport.status === "error" ||
      dbReport.status === "tables_missing" ||
      dbReport.status === "not_configured");

  const overallReady = !anyRequestedBlocked && !isDatabaseBlocking;

  return {
    status: overallReady ? "ready" : "not_ready",
    overall: overallReady ? "ready" : "blocked",
    database: dbReport,
    capabilities: capabilitiesReport,
  };
}
