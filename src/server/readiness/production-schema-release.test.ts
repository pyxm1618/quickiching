import { describe, expect, it, vi } from "vitest";
import {
  classifyAppliedMigrationHistory,
  classifyMigration0012Schema,
  MIGRATION_0012_REQUIRED_OBJECTS,
  resolveProductionDatabaseUrl,
} from "./production-schema-release";

describe("Production Drizzle schema release preflight", () => {
  it("uses a readable Production DATABASE_URL without decrypting any other environment", async () => {
    const readDecryptedValue = vi.fn();
    await expect(resolveProductionDatabaseUrl([
      { key: "DATABASE_URL", target: "preview", value: "not-production" },
      { key: "DATABASE_URL", target: "production", value: "postgres://production/db" },
    ], readDecryptedValue)).resolves.toBe("postgres://production/db");
    expect(readDecryptedValue).not.toHaveBeenCalled();
  });

  it("retrieves a masked Production DATABASE_URL through Vercel's decrypted-by-id response", async () => {
    const readDecryptedValue = vi.fn().mockResolvedValue({
      key: "DATABASE_URL",
      value: "postgresql://production/db",
      decrypted: true,
    });
    await expect(resolveProductionDatabaseUrl([
      { key: "DATABASE_URL", target: ["production"], id: "env_production" },
    ], readDecryptedValue)).resolves.toBe("postgresql://production/db");
    expect(readDecryptedValue).toHaveBeenCalledWith("env_production");
  });

  it("rejects wrong keys, undecrypted values, and non-PostgreSQL values", async () => {
    await expect(resolveProductionDatabaseUrl([
      { key: "DATABASE_URL", target: "production", id: "env_production" },
    ], async () => ({ key: "OTHER_SECRET", value: "postgres://wrong/db", decrypted: true })))
      .rejects.toThrow("PRODUCTION_DATABASE_URL_NOT_DECRYPTED");
    await expect(resolveProductionDatabaseUrl([
      { key: "DATABASE_URL", target: "production", id: "env_production" },
    ], async () => ({ key: "DATABASE_URL", value: "postgres://masked", decrypted: false })))
      .rejects.toThrow("PRODUCTION_DATABASE_URL_NOT_DECRYPTED");
    await expect(resolveProductionDatabaseUrl([
      { key: "DATABASE_URL", target: "production", id: "env_production" },
    ], async () => ({ key: "DATABASE_URL", value: "masked", decrypted: true })))
      .rejects.toThrow("PRODUCTION_DATABASE_URL_UNREADABLE");
  });

  it("rejects ambiguous Production DATABASE_URL entries", async () => {
    await expect(resolveProductionDatabaseUrl([
      { key: "DATABASE_URL", target: "production", value: "postgres://one/db" },
      { key: "DATABASE_URL", target: ["production"], value: "postgres://two/db" },
    ], async () => ({ }))).rejects.toThrow("PRODUCTION_DATABASE_URL_COUNT_INVALID:2");
  });

  it("treats a completely absent migration 0012 schema as pending", () => {
    expect(classifyMigration0012Schema([])).toEqual({
      state: "pending",
      present: [],
      missing: [...MIGRATION_0012_REQUIRED_OBJECTS],
    });
  });

  it("treats all migration 0012 objects present as complete", () => {
    expect(classifyMigration0012Schema([...MIGRATION_0012_REQUIRED_OBJECTS])).toEqual({
      state: "complete",
      present: [...MIGRATION_0012_REQUIRED_OBJECTS],
      missing: [],
    });
  });

  it("identifies partial schema as unsafe for automatic migration", () => {
    const state = classifyMigration0012Schema(MIGRATION_0012_REQUIRED_OBJECTS.slice(1));
    expect(state.state).toBe("partial");
    expect(state.present).toHaveLength(MIGRATION_0012_REQUIRED_OBJECTS.length - 1);
    expect(state.missing).toEqual(["table:question_locks"]);
  });

  it("allows only the exact journal prefix before migration 0012", () => {
    const expected = [
      { createdAt: 10, hash: "migration-one" },
      { createdAt: 20, hash: "migration-two" },
      { createdAt: 30, hash: "migration-twelve" },
    ];

    expect(classifyAppliedMigrationHistory(expected.slice(0, -1), expected)).toBe("pending");
    expect(classifyAppliedMigrationHistory(expected, expected)).toBe("complete");
    expect(classifyAppliedMigrationHistory([{ createdAt: 10, hash: "unexpected" }], expected)).toBe("invalid");
    expect(classifyAppliedMigrationHistory(expected.slice(0, 1), expected)).toBe("invalid");
  });
});
