import { describe, expect, it, vi } from "vitest";
import { REQUIRED_COMMERCIAL_TABLES } from "./readiness-service";
import { EXPECTED_COMMERCIAL_MIGRATIONS } from "./migration-integrity";
import {
  classifyMigrationConnectionError,
  classifyStagingRuntimeDatabase,
  collectStagingRuntimeDiagnostics,
  type StagingRuntimeDatabaseSnapshot,
} from "./staging-runtime-diagnostics";

function snapshot(
  overrides: Partial<StagingRuntimeDatabaseSnapshot> = {},
): StagingRuntimeDatabaseSnapshot {
  return {
    connected: true,
    migrationTablePresent: true,
    migrationStatus: "ok",
    appliedMigrationCount: EXPECTED_COMMERCIAL_MIGRATIONS.length,
    expectedMigrationCount: EXPECTED_COMMERCIAL_MIGRATIONS.length,
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

describe("classifyStagingRuntimeDatabase", () => {
  it("accepts a complete database", () => {
    expect(classifyStagingRuntimeDatabase(snapshot())).toBe("ready");
  });

  it("allows one final pending migration when the required schema already exists", () => {
    expect(classifyStagingRuntimeDatabase(snapshot({
      migrationStatus: "migration_outdated",
      appliedMigrationCount: EXPECTED_COMMERCIAL_MIGRATIONS.length - 1,
    }))).toBe("migration_apply_required");
  });

  it("allows an intact migration prefix to apply all remaining forward migrations", () => {
    expect(classifyStagingRuntimeDatabase(snapshot({
      migrationStatus: "migration_outdated",
      appliedMigrationCount: EXPECTED_COMMERCIAL_MIGRATIONS.length - 2,
      missingTables: [
        "deep_reading_results",
        "entitlement_reservations",
        "workflow_runs",
        "audit_events",
      ],
      presentCp5CoreTables: [],
    }))).toBe("migration_apply_required");
  });

  it("rejects a two-migration replay when an orphan CP5 enum already exists", () => {
    const riskySnapshot = {
      ...snapshot({
        migrationStatus: "migration_outdated",
        appliedMigrationCount: EXPECTED_COMMERCIAL_MIGRATIONS.length - 2,
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

    expect(classifyStagingRuntimeDatabase(riskySnapshot)).toBe(
      "schema_drift_forward_repair_required",
    );
  });

  it("rejects a two-migration replay when an orphan CP5 function already exists", () => {
    const riskySnapshot = {
      ...snapshot({
        migrationStatus: "migration_outdated",
        appliedMigrationCount: EXPECTED_COMMERCIAL_MIGRATIONS.length - 2,
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

    expect(classifyStagingRuntimeDatabase(riskySnapshot)).toBe(
      "schema_drift_forward_repair_required",
    );
  });

  it("requires a forward-only repair when recorded history is complete but schema is missing", () => {
    expect(classifyStagingRuntimeDatabase(snapshot({
      missingTables: ["workflow_runs"],
    }))).toBe("schema_drift_forward_repair_required");
  });

  it("blocks historical hash drift", () => {
    expect(classifyStagingRuntimeDatabase(snapshot({
      migrationStatus: "migration_hash_mismatch",
    }))).toBe("blocked_migration_integrity");
  });

  it("blocks a database without Drizzle migration history", () => {
    expect(classifyStagingRuntimeDatabase(snapshot({
      migrationTablePresent: false,
      migrationStatus: "migration_missing",
      appliedMigrationCount: 0,
    }))).toBe("blocked_migration_history");
  });
});

describe("migration connection diagnostics", () => {
  it("classifies connection errors without preserving secret-bearing messages", () => {
    const error = Object.assign(
      new Error(
        "connect ENETUNREACH secret-user:secret-password@db-secret.internal:5432",
      ),
      { code: "ENETUNREACH" },
    );

    const result = classifyMigrationConnectionError(error);

    expect(result).toEqual({
      category: "network_unreachable",
      code: "ENETUNREACH",
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("secret-password");
    expect(serialized).not.toContain("db-secret.internal");
    expect(serialized).not.toContain("secret-user");
  });

  it("never passes through arbitrary error codes", () => {
    const error = Object.assign(new Error("host=db-secret.internal"), {
      code: "db-secret.internal-secret-code",
    });

    expect(classifyMigrationConnectionError(error)).toEqual({
      category: "unknown",
      code: null,
    });
  });
});

describe("collectStagingRuntimeDiagnostics", () => {
  it("returns only status metadata while evaluating real staging prerequisites", async () => {
    const db = {
      ping: vi.fn().mockResolvedValue(undefined),
      queryTables: vi.fn().mockResolvedValue([...REQUIRED_COMMERCIAL_TABLES]),
      queryMigrationTablePresent: vi.fn().mockResolvedValue(true),
      queryMigrations: vi.fn().mockResolvedValue(
        EXPECTED_COMMERCIAL_MIGRATIONS.map((migration) => ({ ...migration })),
      ),
    };
    const env = {
      WAFFO_ENVIRONMENT: "test",
      APP_BASE_URL: "https://staging.quickiching.com",
      NEXT_PUBLIC_APP_URL: "https://staging.quickiching.com",
      BETTER_AUTH_URL: "https://staging.quickiching.com",
      DATABASE_URL: "postgresql://secret-user:secret-password@db.invalid/secret-db",
      DATABASE_URL_UNPOOLED:
        "postgresql://migration-user:migration-password@migration-secret.invalid/secret-db",
      CP6_STAGING_MAINTENANCE_TOKEN: "maintenance-secret-that-must-never-leak",
    };
    const migrationProbe = vi.fn().mockResolvedValue({
      source: "DATABASE_URL_UNPOOLED" as const,
      connected: true,
      sameLogicalDatabase: true,
      migrationHistoryMatchesRuntime: true,
      schemaCreatePrivilege: true,
      requiredReferencesPrivilege: true,
      generationReviewTriggerPrivilege: true,
      error: null,
    });

    const result = await collectStagingRuntimeDiagnostics(env, db, migrationProbe);

    expect(result.database.classification).toBe("ready");
    expect(result.provider).toEqual({
      waffoEnvironmentIsTest: true,
      originChecks: {
        appBaseUrl: true,
        publicAppUrl: true,
        betterAuthUrl: true,
      },
    });
    expect(result.migrationConnection).toEqual({
      source: "DATABASE_URL_UNPOOLED",
      connected: true,
      sameLogicalDatabase: true,
      migrationHistoryMatchesRuntime: true,
      schemaCreatePrivilege: true,
      requiredReferencesPrivilege: true,
      generationReviewTriggerPrivilege: true,
      error: null,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("secret-password");
    expect(serialized).not.toContain("migration-password");
    expect(serialized).not.toContain("migration-secret.invalid");
    expect(serialized).not.toContain("maintenance-secret");
    expect(serialized).not.toContain("secret-db");
  });
});
