import { describe, expect, it } from "vitest";
import {
  classifyStagingDatabase,
  inspectStagingCapabilityConfiguration,
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
