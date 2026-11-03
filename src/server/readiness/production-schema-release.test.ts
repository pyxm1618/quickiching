import { describe, expect, it, vi } from "vitest";
import {
  classifyAppliedMigrationHistory,
  classifyCurrentSchema,
  CURRENT_REQUIRED_SCHEMA_OBJECTS,
  RETIRED_SCHEMA_OBJECTS,
  requireProductionDatabaseUrl,
  resolveProductionDatabaseUrl,
} from "./production-schema-release";

describe("Production Drizzle schema release preflight", () => {
  it("accepts only PostgreSQL URLs from the dedicated Production release secret", () => {
    expect(requireProductionDatabaseUrl(" postgres://production/db ")).toBe("postgres://production/db");
    expect(() => requireProductionDatabaseUrl("https://example.com/db")).toThrow("PRODUCTION_DATABASE_URL_INVALID");
    expect(() => requireProductionDatabaseUrl("")).toThrow("PRODUCTION_DATABASE_URL_INVALID");
  });

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

  it("treats the 0012 schema with question_locks still present as pending 0013", () => {
    expect(classifyCurrentSchema([
      ...CURRENT_REQUIRED_SCHEMA_OBJECTS,
      ...RETIRED_SCHEMA_OBJECTS,
    ])).toEqual({
      state: "pending",
      present: [...CURRENT_REQUIRED_SCHEMA_OBJECTS],
      missing: [],
      retiredPresent: [...RETIRED_SCHEMA_OBJECTS],
    });
  });

  it("treats current required objects without question_locks as complete", () => {
    expect(classifyCurrentSchema([...CURRENT_REQUIRED_SCHEMA_OBJECTS])).toEqual({
      state: "complete",
      present: [...CURRENT_REQUIRED_SCHEMA_OBJECTS],
      missing: [],
      retiredPresent: [],
    });
  });

  it("identifies missing current schema objects as partial", () => {
    const state = classifyCurrentSchema(CURRENT_REQUIRED_SCHEMA_OBJECTS.slice(1));
    expect(state.state).toBe("partial");
    expect(state.present).toHaveLength(CURRENT_REQUIRED_SCHEMA_OBJECTS.length - 1);
    expect(state.missing).toEqual(["table:deep_reading_context_snapshots"]);
    expect(state.retiredPresent).toEqual([]);
  });

  it("allows only the exact journal prefix before the current migration", () => {
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
