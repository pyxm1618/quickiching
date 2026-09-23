import { describe, expect, it } from "vitest";
import {
  classifyStagingDatabase,
  inspectStagingCapabilityConfiguration,
  resolveStagingMigrationDatabaseUrl,
  selectProductionVercelEnv,
  validateStagingMigrationBuildContext,
  type StagingDatabaseSnapshot,
} from "../../../scripts/cp6-staging-preflight";

function snapshot(overrides: Partial<StagingDatabaseSnapshot> = {}): StagingDatabaseSnapshot {
  return {
    migrationTablePresent: true,
    migrationStatus: "ok",
    appliedMigrationCount: 11,
    expectedMigrationCount: 11,
    missingTables: [],
    presentCp5CoreTables: [
      "audit_events",
      "workflow_runs",
      "deep_reading_results",
      "entitlement_reservations",
    ],
    ...overrides,
  };
}

describe("classifyStagingDatabase", () => {
  it("accepts a complete matching database", () => {
    expect(classifyStagingDatabase(snapshot())).toBe("ready");
  });

  it("permits only the final pending migration when required tables are already complete", () => {
    expect(classifyStagingDatabase(snapshot({
      migrationStatus: "migration_outdated",
      appliedMigrationCount: 10,
    }))).toBe("migration_apply_required");
  });

  it("permits the intact 0000-0008 prefix to apply pending 0009 and 0010 when CP5 core is entirely absent", () => {
    expect(classifyStagingDatabase(snapshot({
      migrationStatus: "migration_outdated",
      appliedMigrationCount: 9,
      missingTables: [
        "deep_reading_results",
        "entitlement_reservations",
        "workflow_runs",
        "audit_events",
      ],
      presentCp5CoreTables: [],
    }))).toBe("migration_apply_required");
  });

  it("blocks pending 0009 and 0010 when an orphan CP5 enum already exists", () => {
    const riskySnapshot = {
      ...snapshot({
        migrationStatus: "migration_outdated",
        appliedMigrationCount: 9,
        missingTables: [
          "deep_reading_results",
          "entitlement_reservations",
          "workflow_runs",
          "audit_events",
        ],
        presentCp5CoreTables: [],
      }),
      presentCp5OwnedTypes: ["audit_category"],
      presentCp5OwnedFunctions: [],
      presentCp5OwnedTriggers: [],
    };

    expect(classifyStagingDatabase(riskySnapshot)).toBe(
      "schema_drift_forward_repair_required",
    );
  });

  it("blocks pending 0009 and 0010 when an orphan CP5 function already exists", () => {
    const riskySnapshot = {
      ...snapshot({
        migrationStatus: "migration_outdated",
        appliedMigrationCount: 9,
        missingTables: [
          "deep_reading_results",
          "entitlement_reservations",
          "workflow_runs",
          "audit_events",
        ],
        presentCp5CoreTables: [],
      }),
      presentCp5OwnedTypes: [],
      presentCp5OwnedFunctions: ["prevent_deep_reading_results_mutation"],
      presentCp5OwnedTriggers: [],
    };

    expect(classifyStagingDatabase(riskySnapshot)).toBe(
      "schema_drift_forward_repair_required",
    );
  });

  it("requires a forward-only repair when history is complete but schema is missing a required table", () => {
    expect(classifyStagingDatabase(snapshot({
      missingTables: ["workflow_runs"],
      presentCp5CoreTables: ["audit_events", "deep_reading_results", "entitlement_reservations"],
    }))).toBe("schema_drift_forward_repair_required");
  });

  it("does not replay 0009 automatically when multiple historical migrations are outstanding", () => {
    expect(classifyStagingDatabase(snapshot({
      migrationStatus: "migration_outdated",
      appliedMigrationCount: 9,
      missingTables: ["audit_events", "workflow_runs"],
      presentCp5CoreTables: ["deep_reading_results", "entitlement_reservations"],
    }))).toBe("schema_drift_forward_repair_required");
  });

  it("blocks historical hash drift", () => {
    expect(classifyStagingDatabase(snapshot({
      migrationStatus: "migration_hash_mismatch",
    }))).toBe("blocked_migration_integrity");
  });

  it("blocks databases without Drizzle migration history", () => {
    expect(classifyStagingDatabase(snapshot({
      migrationTablePresent: false,
      migrationStatus: "migration_missing",
      appliedMigrationCount: 0,
    }))).toBe("blocked_migration_history");
  });
});

describe("staging migration safety", () => {
  it("uses only a dedicated or explicitly unpooled migration connection", () => {
    expect(resolveStagingMigrationDatabaseUrl({
      MIGRATION_DATABASE_URL: "postgresql://direct.example/migrate",
      DATABASE_URL_UNPOOLED: "postgresql://unpooled.example/app",
      DATABASE_URL: "postgresql://pool.example/app",
    })).toBe("postgresql://direct.example/migrate");

    expect(resolveStagingMigrationDatabaseUrl({
      DATABASE_URL_UNPOOLED: "postgresql://unpooled.example/app",
      DATABASE_URL: "postgresql://pool.example/app",
    })).toBe("postgresql://unpooled.example/app");

    expect(() => resolveStagingMigrationDatabaseUrl({
      DATABASE_URL: "postgresql://pool.example/app",
    })).toThrow("STAGING_MIGRATION_DATABASE_URL_UNAVAILABLE");
  });

  it("requires an exact staging Production build and SHA-bound one-time marker", () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    expect(() => validateStagingMigrationBuildContext({
      CP6_STAGING_APPLY_PENDING_MIGRATIONS: sha,
      VERCEL_GIT_COMMIT_SHA: sha,
      VERCEL_GIT_COMMIT_REF: "codex/commercial-v2-cp6-repair",
      VERCEL_PROJECT_ID: "prj_iKtw9xKmIlEfe44gEocgLr2QDLfE",
      VERCEL_ENV: "production",
      VERCEL_TARGET_ENV: "production",
    })).not.toThrow();

    expect(() => validateStagingMigrationBuildContext({
      CP6_STAGING_APPLY_PENDING_MIGRATIONS: "different-sha",
      VERCEL_GIT_COMMIT_SHA: sha,
      VERCEL_GIT_COMMIT_REF: "codex/commercial-v2-cp6-repair",
      VERCEL_PROJECT_ID: "prj_iKtw9xKmIlEfe44gEocgLr2QDLfE",
      VERCEL_ENV: "production",
      VERCEL_TARGET_ENV: "production",
    })).toThrow("STAGING_MIGRATION_BUILD_CONTEXT_INVALID");
  });
});

describe("inspectStagingCapabilityConfiguration", () => {
  it("fails closed when the staging provider environment is not Waffo test", () => {
    const result = inspectStagingCapabilityConfiguration({
      WAFFO_ENVIRONMENT: "prod",
      APP_BASE_URL: "https://staging.quickiching.com",
      NEXT_PUBLIC_APP_URL: "https://staging.quickiching.com",
      BETTER_AUTH_URL: "https://staging.quickiching.com",
    });
    expect(result.ok).toBe(false);
    expect(result.waffoEnvironment).toBe("invalid");
  });

  it("fails closed when any public/auth origin is not the staging origin", () => {
    const result = inspectStagingCapabilityConfiguration({
      WAFFO_ENVIRONMENT: "test",
      APP_BASE_URL: "https://staging.quickiching.com",
      NEXT_PUBLIC_APP_URL: "https://quickiching.com",
      BETTER_AUTH_URL: "https://staging.quickiching.com",
    });
    expect(result.ok).toBe(false);
    expect(result.originChecks.NEXT_PUBLIC_APP_URL).toBe(false);
  });
});

describe("selectProductionVercelEnv", () => {
  it("keeps only values that target production", () => {
    expect(selectProductionVercelEnv([
      { key: "DATABASE_URL", value: "postgres://staging", target: ["production"] },
      { key: "PREVIEW_ONLY", value: "ignore", target: ["preview"] },
      { key: "SHARED", value: "keep", target: ["preview", "production"] },
    ])).toEqual({
      DATABASE_URL: "postgres://staging",
      SHARED: "keep",
    });
  });

  it("ignores malformed or undecrypted entries instead of inventing values", () => {
    expect(selectProductionVercelEnv([
      { key: "EMPTY", value: undefined, target: ["production"] },
      { key: "NO_TARGET", value: "ignore", target: undefined },
      { key: "VALID", value: "ok", target: "production" },
    ])).toEqual({ VALID: "ok" });
  });
});
