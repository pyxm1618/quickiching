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
const STAGING_VERCEL_PROJECT_ID = "prj_iKtw9xKmIlEfe44gEocgLr2QDLfE";
const STAGING_REPAIR_BRANCH = "codex/commercial-v2-cp6-repair";
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

export type VercelEnvEntry = {
  id?: unknown;
  key?: unknown;
  value?: unknown;
  target?: unknown;
  type?: unknown;
  decrypted?: unknown;
};

type VercelProductionEnvFetch = {
  values: Record<string, string>;
  unreadableSensitiveKeys: string[];
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

export function resolveStagingMigrationDatabaseUrl(
  env: Record<string, string | undefined>,
): string {
  const explicit = env.MIGRATION_DATABASE_URL?.trim();
  if (explicit) return explicit;
  const unpooled = env.DATABASE_URL_UNPOOLED?.trim();
  if (unpooled) return unpooled;
  throw new Error("STAGING_MIGRATION_DATABASE_URL_UNAVAILABLE");
}

export function validateStagingMigrationBuildContext(
  env: Record<string, string | undefined>,
): void {
  const marker = env.CP6_STAGING_APPLY_PENDING_MIGRATIONS?.trim();
  const sha = env.VERCEL_GIT_COMMIT_SHA?.trim();
  const valid = Boolean(marker)
    && marker === sha
    && env.VERCEL_GIT_COMMIT_REF?.trim() === STAGING_REPAIR_BRANCH
    && env.VERCEL_PROJECT_ID?.trim() === STAGING_VERCEL_PROJECT_ID
    && env.VERCEL_ENV?.trim() === "production"
    && env.VERCEL_TARGET_ENV?.trim() === "production";
  if (!valid) throw new Error("STAGING_MIGRATION_BUILD_CONTEXT_INVALID");
}

function targetsProduction(target: unknown): boolean {
  if (target === "production") return true;
  return Array.isArray(target) && target.includes("production");
}

export function selectProductionVercelEnv(entries: readonly VercelEnvEntry[]): Record<string, string> {
  const selected: Record<string, string> = {};
  for (const entry of entries) {
    if (!targetsProduction(entry.target)) continue;
    if (typeof entry.key !== "string" || !entry.key.trim()) continue;
    if (typeof entry.value !== "string") continue;
    const key = entry.key.trim();
    if (Object.prototype.hasOwnProperty.call(selected, key)) {
      throw new Error(`VERCEL_PRODUCTION_ENV_DUPLICATE:${key}`);
    }
    selected[key] = entry.value;
  }
  return selected;
}

function vercelHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

type VercelEnvValueResult =
  | { kind: "value"; value: string }
  | { kind: "unreadable_sensitive"; key: string };

async function fetchVercelEnvValue(
  token: string,
  projectId: string,
  entry: VercelEnvEntry,
): Promise<VercelEnvValueResult> {
  const key = typeof entry.key === "string" ? entry.key.trim() : "UNKNOWN";
  const id = typeof entry.id === "string" ? entry.id.trim() : "";
  if (!id) throw new Error(`VERCEL_ENV_ID_MISSING:${key}`);

  const url = `https://api.vercel.com/v1/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(id)}`;
  const response = await fetch(url, { headers: vercelHeaders(token) });
  if (!response.ok) {
    throw new Error(`VERCEL_ENV_VALUE_FETCH_FAILED:${key}:${response.status}`);
  }

  const payload = await response.json() as VercelEnvEntry;
  if (typeof payload.value === "string") {
    return { kind: "value", value: payload.value };
  }

  const type = typeof payload.type === "string" ? payload.type : "unknown";
  if (type === "sensitive" && payload.decrypted !== true) {
    return { kind: "unreadable_sensitive", key };
  }
  const decrypted = payload.decrypted === true ? "true" : "false";
  throw new Error(`VERCEL_ENV_VALUE_UNAVAILABLE:${key}:${type}:decrypted=${decrypted}`);
}

async function fetchVercelProductionEnv(token: string, projectId: string): Promise<VercelProductionEnvFetch> {
  if (projectId !== STAGING_VERCEL_PROJECT_ID) {
    throw new Error(`STAGING_PROJECT_BINDING_MISMATCH:${projectId}`);
  }

  const url = new URL(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env`);
  url.searchParams.set("decrypt", "true");
  url.searchParams.set("source", "vercel-cli:pull");

  const response = await fetch(url, { headers: vercelHeaders(token) });
  if (!response.ok) {
    throw new Error(`VERCEL_ENV_FETCH_FAILED:${response.status}`);
  }

  const payload = await response.json() as { envs?: unknown };
  if (!Array.isArray(payload.envs)) {
    throw new Error("VERCEL_ENV_RESPONSE_INVALID");
  }

  const productionEntries = (payload.envs as VercelEnvEntry[])
    .filter((entry) => targetsProduction(entry.target))
    .sort((left, right) => {
      const leftKey = typeof left.key === "string" ? left.key : "";
      const rightKey = typeof right.key === "string" ? right.key : "";
      if (leftKey === "DATABASE_URL") return -1;
      if (rightKey === "DATABASE_URL") return 1;
      return leftKey.localeCompare(rightKey);
    });

  const values: Record<string, string> = {};
  const unreadableSensitiveKeys: string[] = [];
  const seen = new Set<string>();
  for (const entry of productionEntries) {
    if (typeof entry.key !== "string" || !entry.key.trim()) continue;
    const key = entry.key.trim();
    if (seen.has(key)) throw new Error(`VERCEL_PRODUCTION_ENV_DUPLICATE:${key}`);
    seen.add(key);

    if (typeof entry.value === "string" && entry.value.length > 0) {
      values[key] = entry.value;
      continue;
    }

    const resolved = await fetchVercelEnvValue(token, projectId, entry);
    if (resolved.kind === "value") values[key] = resolved.value;
    else unreadableSensitiveKeys.push(resolved.key);
  }

  return {
    values,
    unreadableSensitiveKeys: unreadableSensitiveKeys.sort(),
  };
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
    const pendingMigrationCount = snapshot.expectedMigrationCount - snapshot.appliedMigrationCount;
    const onlyFinalMigrationPending = pendingMigrationCount === 1;
    if (onlyFinalMigrationPending && snapshot.missingTables.length === 0) {
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

function runMigration(runtimeEnv: NodeJS.ProcessEnv): void {
  const migrationDatabaseUrl = resolveStagingMigrationDatabaseUrl(runtimeEnv);
  const result = spawnSync("bun", ["run", "db:migrate"], {
    stdio: "inherit",
    env: {
      ...runtimeEnv,
      MIGRATION_DATABASE_URL: migrationDatabaseUrl,
    },
  });
  if (result.status !== 0) {
    throw new Error(`STAGING_MIGRATION_FAILED:${String(result.status)}`);
  }
}

async function main(): Promise<void> {
  const requireFlagsEnabled = process.argv.includes("--require-flags-enabled");
  const applyPendingMigration = process.argv.includes("--apply-pending-migration");
  const databaseOnly = process.argv.includes("--database-only");
  const fromVercelProductionEnv = process.argv.includes("--from-vercel-production-env");
  if (databaseOnly && !applyPendingMigration) {
    throw new Error("DATABASE_ONLY_REQUIRES_APPLY_PENDING_MIGRATION");
  }

  let runtimeEnv: NodeJS.ProcessEnv = { ...process.env };
  let unreadableSensitiveKeys: string[] = [];
  if (fromVercelProductionEnv) {
    const token = process.env.VERCEL_TOKEN?.trim();
    const projectId = process.env.VERCEL_PROJECT_ID?.trim();
    if (!token) throw new Error("VERCEL_TOKEN_MISSING");
    if (!projectId) throw new Error("VERCEL_PROJECT_ID_MISSING");
    const productionEnv = await fetchVercelProductionEnv(token, projectId);
    runtimeEnv = { ...runtimeEnv, ...productionEnv.values };
    unreadableSensitiveKeys = productionEnv.unreadableSensitiveKeys;
  }

  if (applyPendingMigration) {
    validateStagingMigrationBuildContext(runtimeEnv);
  }

  const capability = inspectStagingCapabilityConfiguration(runtimeEnv, requireFlagsEnabled);
  const vercelEnv = {
    unreadableSensitiveKeys,
    sensitiveValuesRuntimeOnly: unreadableSensitiveKeys.length > 0,
  };

  const databaseUrl = runtimeEnv.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.log(JSON.stringify({ vercelEnv, capability, database: { error: "DATABASE_URL_UNAVAILABLE" } }, null, 2));
    process.exitCode = 2;
    return;
  }

  let database = await inspectDatabase(databaseUrl);
  let classification = classifyStagingDatabase(database);

  console.log(JSON.stringify({ vercelEnv, capability, database, classification }, null, 2));

  if (!databaseOnly && (!capability.ok || unreadableSensitiveKeys.length > 0)) {
    process.exitCode = 3;
    return;
  }

  if (applyPendingMigration) {
    if (classification !== "migration_apply_required") {
      if (classification !== "ready") process.exitCode = 4;
      return;
    }

    // Only an exact, hash-verified tail state may migrate automatically:
    // either the final migration is pending with the required schema already
    // complete, or 0009+0010 are both pending and all CP5 core tables are
    // entirely absent. Partial CP5 schema remains a hard stop and requires a
    // new forward-only repair migration rather than replaying history.
    runMigration(runtimeEnv);
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
