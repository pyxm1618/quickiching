import { closeCommercialDatabaseConnection } from "../src/server/db/client";
import { collectStagingRuntimeDiagnostics } from "../src/server/readiness/staging-runtime-diagnostics";
import { collectWaffoTestCatalogDiagnostics } from "../src/server/readiness/waffo-staging-catalog-read";

const PROJECT_ID = "prj_iKtw9xKmIlEfe44gEocgLr2QDLfE";
const TEAM_ID = "team_z1b9TTQtbNkr43dzs5JVJPnQ";
const STAGING_ORIGIN = "https://staging.quickiching.com";

type EnvEntry = {
  key?: unknown;
  target?: unknown;
  value?: unknown;
  gitBranch?: unknown;
};

type VercelEnvResponse = { envs?: EnvEntry[] };

function targetsProduction(value: unknown): boolean {
  return value === "production" || (Array.isArray(value) && value.includes("production"));
}

async function readProjectProductionEnv(token: string): Promise<Record<string, string>> {
  const url = new URL(`https://api.vercel.com/v10/projects/${PROJECT_ID}/env`);
  url.searchParams.set("teamId", TEAM_ID);
  url.searchParams.set("decrypt", "true");
  url.searchParams.set("source", "vercel-cli:pull");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`VERCEL_ENV_READ_FAILED:${response.status}`);

  const body = await response.json() as VercelEnvResponse;
  if (!Array.isArray(body.envs)) throw new Error("VERCEL_ENV_LIST_INVALID");

  const grouped = new Map<string, string[]>();
  for (const entry of body.envs) {
    if (!targetsProduction(entry.target)) continue;
    if (typeof entry.gitBranch === "string" && entry.gitBranch.trim()) continue;
    if (typeof entry.key !== "string" || !entry.key.trim()) continue;
    if (typeof entry.value !== "string" || !entry.value.trim()) continue;
    const values = grouped.get(entry.key) ?? [];
    values.push(entry.value);
    grouped.set(entry.key, values);
  }

  const result: Record<string, string> = {};
  for (const [key, values] of grouped.entries()) {
    const unique = [...new Set(values)];
    if (unique.length !== 1) throw new Error(`STAGING_ENV_AMBIGUOUS:${key}`);
    result[key] = unique[0];
  }
  return result;
}

function requireValue(env: Record<string, string>, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`STAGING_ENV_REQUIRED:${key}`);
  return value;
}

function assertReady(result: Awaited<ReturnType<typeof collectStagingRuntimeDiagnostics>>): void {
  if (!result.database.connected) throw new Error("STAGING_DATABASE_NOT_CONNECTED");
  if (!result.database.migrationTablePresent) throw new Error("STAGING_MIGRATION_TABLE_MISSING");
  if (result.database.migrationStatus !== "ok") throw new Error(`STAGING_MIGRATION_STATUS:${result.database.migrationStatus}`);
  if (result.database.classification !== "ready") throw new Error(`STAGING_DATABASE_CLASSIFICATION:${result.database.classification}`);
  if (result.database.missingTables.length !== 0) throw new Error("STAGING_DATABASE_TABLES_MISSING");
  if (result.database.appliedMigrationCount !== result.database.expectedMigrationCount) {
    throw new Error("STAGING_MIGRATION_COUNT_MISMATCH");
  }
  if (!result.migrationConnection.connected) throw new Error("STAGING_MIGRATION_CONNECTION_FAILED");
  if (result.migrationConnection.sameLogicalDatabase !== true) throw new Error("STAGING_MIGRATION_DATABASE_MISMATCH");
  if (result.migrationConnection.migrationHistoryMatchesRuntime !== true) throw new Error("STAGING_MIGRATION_HISTORY_MISMATCH");
  if (result.migrationConnection.schemaCreatePrivilege !== true) throw new Error("STAGING_SCHEMA_CREATE_PRIVILEGE_MISSING");
  if (result.migrationConnection.requiredReferencesPrivilege !== true) throw new Error("STAGING_REFERENCES_PRIVILEGE_MISSING");
  if (result.migrationConnection.generationReviewTriggerPrivilege !== true) throw new Error("STAGING_TRIGGER_PRIVILEGE_MISSING");
  if (!result.provider.waffoEnvironmentIsTest) throw new Error("STAGING_WAFFO_ENVIRONMENT_INVALID");
}

function safeFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const safePrefixes = [
    "VERCEL_ENV_READ_FAILED:",
    "VERCEL_ENV_LIST_INVALID",
    "STAGING_ENV_AMBIGUOUS:",
    "STAGING_ENV_REQUIRED:",
    "STAGING_APP_ENV_INVALID",
    "STAGING_WAFFO_ENV_INVALID",
    "STAGING_DATABASE_",
    "STAGING_MIGRATION_",
    "STAGING_SCHEMA_",
    "STAGING_REFERENCES_",
    "STAGING_TRIGGER_",
    "STAGING_WAFFO_ENVIRONMENT_INVALID",
    "WAFFO_TEST_CATALOG_NOT_READY:",
    "VERCEL_TOKEN_UNAVAILABLE",
  ];
  return safePrefixes.some((prefix) => message.startsWith(prefix))
    ? message
    : "STAGING_READONLY_AUDIT_FAILED";
}

async function main(): Promise<void> {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) throw new Error("VERCEL_TOKEN_UNAVAILABLE");

  const pulled = await readProjectProductionEnv(token);
  if (requireValue(pulled, "APP_ENV") !== "staging") throw new Error("STAGING_APP_ENV_INVALID");
  if (requireValue(pulled, "WAFFO_ENVIRONMENT") !== "test") throw new Error("STAGING_WAFFO_ENV_INVALID");
  requireValue(pulled, "DATABASE_URL");
  requireValue(pulled, "WAFFO_MERCHANT_ID");
  requireValue(pulled, "WAFFO_PRIVATE_KEY");
  requireValue(pulled, "WAFFO_STORE_ID");
  requireValue(pulled, "WAFFO_TEST_PRODUCT_ID_ONE");
  requireValue(pulled, "WAFFO_TEST_PRODUCT_ID_THREE");
  requireValue(pulled, "WAFFO_TEST_PRODUCT_ID_FIVE");

  for (const [key, value] of Object.entries(pulled)) process.env[key] = value;
  process.env.VERCEL_ENV = "production";
  process.env.VERCEL_PROJECT_ID = PROJECT_ID;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "staging.quickiching.com";
  process.env.QUICKICHING_DEPLOYMENT_TIER = "staging";
  process.env.APP_BASE_URL = STAGING_ORIGIN;

  const runtime = await collectStagingRuntimeDiagnostics(process.env);
  assertReady(runtime);
  const waffoCatalog = await collectWaffoTestCatalogDiagnostics(process.env);
  if (!waffoCatalog.ok) throw new Error(`WAFFO_TEST_CATALOG_NOT_READY:${waffoCatalog.reason}`);

  const evidence = {
    source: "vercel_project_production_env_readonly",
    applicationEnvironment: "staging",
    database: {
      connected: runtime.database.connected,
      migrationTablePresent: runtime.database.migrationTablePresent,
      migrationStatus: runtime.database.migrationStatus,
      classification: runtime.database.classification,
      appliedMigrationCount: runtime.database.appliedMigrationCount,
      expectedMigrationCount: runtime.database.expectedMigrationCount,
      missingTables: runtime.database.missingTables,
    },
    migrationConnection: {
      source: runtime.migrationConnection.source,
      connected: runtime.migrationConnection.connected,
      sameLogicalDatabase: runtime.migrationConnection.sameLogicalDatabase,
      migrationHistoryMatchesRuntime: runtime.migrationConnection.migrationHistoryMatchesRuntime,
      schemaCreatePrivilege: runtime.migrationConnection.schemaCreatePrivilege,
      requiredReferencesPrivilege: runtime.migrationConnection.requiredReferencesPrivilege,
      generationReviewTriggerPrivilege: runtime.migrationConnection.generationReviewTriggerPrivilege,
      error: runtime.migrationConnection.error,
    },
    provider: runtime.provider,
    waffoCatalog,
  };
  console.log(JSON.stringify(evidence, null, 2));
}

main()
  .catch((error) => {
    console.error(safeFailureCode(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closeCommercialDatabaseConnection();
    } catch {
      // Do not turn connection-close failures into secret-bearing logs.
    }
  });
