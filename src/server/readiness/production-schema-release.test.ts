import { describe, expect, it, vi } from "vitest";
import {
  assessRecoveryPosture,
  classifyAppliedMigrationHistory,
  classifyCurrentSchema,
  classifyProductionMigrationPreflight,
  CURRENT_REQUIRED_SCHEMA_OBJECTS,
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

  it("treats all current required objects as complete", () => {
    expect(classifyCurrentSchema([...CURRENT_REQUIRED_SCHEMA_OBJECTS])).toEqual({
      state: "complete",
      present: [...CURRENT_REQUIRED_SCHEMA_OBJECTS],
      missing: [],
    });
  });

  it("identifies missing current schema objects as partial", () => {
    const state = classifyCurrentSchema(CURRENT_REQUIRED_SCHEMA_OBJECTS.slice(1));
    expect(state.state).toBe("partial");
    expect(state.present).toHaveLength(CURRENT_REQUIRED_SCHEMA_OBJECTS.length - 1);
    expect(state.missing).toEqual(["table:deep_reading_context_snapshots"]);
  });

  it("allows any exact journal prefix before the full manifest as pending", () => {
    const expected = [
      { createdAt: 10, hash: "migration-one" },
      { createdAt: 20, hash: "migration-two" },
      { createdAt: 30, hash: "migration-twelve" },
      { createdAt: 40, hash: "migration-thirteen" },
    ];

    expect(classifyAppliedMigrationHistory(expected.slice(0, -1), expected)).toBe("pending");
    expect(classifyAppliedMigrationHistory(expected.slice(0, -2), expected)).toBe("pending");
    expect(classifyAppliedMigrationHistory(expected.slice(0, 1), expected)).toBe("pending");
    expect(classifyAppliedMigrationHistory(expected, expected)).toBe("complete");
    expect(classifyAppliedMigrationHistory([{ createdAt: 10, hash: "unexpected" }], expected)).toBe("invalid");
    expect(classifyAppliedMigrationHistory(expected.slice(0, 2).map((entry, index) =>
      index === 1 ? { ...entry, hash: "tampered" } : entry), expected)).toBe("invalid");
    expect(classifyAppliedMigrationHistory([...expected, { createdAt: 50, hash: "extra" }], expected)).toBe("invalid");
  });

  it("does not treat a managed provider hostname as recovery evidence", () => {
    expect(assessRecoveryPosture({
      managedBackupProvider: true,
      archiveMode: "off",
      walArchivingObserved: false,
    })).toEqual({ recoveryConfirmed: false, recoveryEvidence: "WAL_ARCHIVING_DISABLED" });
    expect(assessRecoveryPosture({
      managedBackupProvider: true,
      archiveMode: null,
      walArchivingObserved: null,
    })).toEqual({ recoveryConfirmed: false, recoveryEvidence: "WAL_ARCHIVING_UNREADABLE" });
    expect(assessRecoveryPosture({
      managedBackupProvider: true,
      archiveMode: "replica",
      walArchivingObserved: false,
    })).toEqual({ recoveryConfirmed: false, recoveryEvidence: "WAL_ARCHIVING_NOT_OBSERVED" });
  });

  it("confirms recovery prerequisites only after observing WAL archiving with archiving enabled", () => {
    expect(assessRecoveryPosture({
      managedBackupProvider: false,
      archiveMode: "on",
      walArchivingObserved: true,
    })).toEqual({ recoveryConfirmed: true, recoveryEvidence: "WAL_ARCHIVING_OBSERVED" });
    expect(assessRecoveryPosture({
      managedBackupProvider: true,
      archiveMode: "off",
      walArchivingObserved: true,
    })).toEqual({ recoveryConfirmed: false, recoveryEvidence: "WAL_ARCHIVING_DISABLED" });
  });

  it("accepts production before the two consecutive pending migrations", () => {
    const preflight = classifyProductionMigrationPreflight({
      refundIntegrityApplied: false,
      accountIdentityApplied: false,
      columns: [
        { table: "accounts", column: "issuer", isNullable: false },
      ],
      indexes: [{ name: "accounts_issuer_account_id_idx", definition: "CREATE UNIQUE INDEX accounts_issuer_account_id_idx ON public.accounts USING btree (issuer, account_id)" }],
      duplicateAccountIdentities: 0,
    });

    expect(preflight.state).toBe("ready");
    expect(preflight.issues).toEqual([]);
  });

  it("accepts production after only the refund integrity migration", () => {
    const preflight = classifyProductionMigrationPreflight({
      refundIntegrityApplied: true,
      accountIdentityApplied: false,
      columns: [
        { table: "entitlement_batches", column: "refund_locked", isNullable: false },
        { table: "refund_intents", column: "decision_operator_id", isNullable: true },
        { table: "refund_intents", column: "dispatch_operator_id", isNullable: true },
        { table: "accounts", column: "issuer", isNullable: false },
      ],
      indexes: [{ name: "accounts_issuer_account_id_idx", definition: "CREATE UNIQUE INDEX accounts_issuer_account_id_idx ON public.accounts USING btree (issuer, account_id)" }],
      duplicateAccountIdentities: 0,
    });

    expect(preflight.state).toBe("ready");
  });

  it("accepts production after both migrations", () => {
    const preflight = classifyProductionMigrationPreflight({
      refundIntegrityApplied: true,
      accountIdentityApplied: true,
      columns: [
        { table: "entitlement_batches", column: "refund_locked", isNullable: false, columnDefault: "false" },
        { table: "refund_intents", column: "decision_operator_id", isNullable: true },
        { table: "refund_intents", column: "dispatch_operator_id", isNullable: true },
        { table: "accounts", column: "issuer", isNullable: true },
      ],
      indexes: [{
        name: "accounts_provider_account_id_idx",
        definition: "CREATE UNIQUE INDEX accounts_provider_account_id_idx ON public.accounts USING btree (provider_id, account_id)",
        isValid: true,
      }],
      duplicateAccountIdentities: 0,
    });

    expect(preflight.state).toBe("ready");
    expect(preflight.checks["unique_index:accounts_provider_account_id"]).toBe(true);
    expect(preflight.checks["default:entitlement_batches.refund_locked"]).toBe(true);
  });

  it("blocks an invalid identity index and a wrong refund lock default", () => {
    const preflight = classifyProductionMigrationPreflight({
      refundIntegrityApplied: true,
      accountIdentityApplied: true,
      columns: [
        { table: "entitlement_batches", column: "refund_locked", isNullable: false, columnDefault: "true" },
        { table: "refund_intents", column: "decision_operator_id", isNullable: true },
        { table: "refund_intents", column: "dispatch_operator_id", isNullable: true },
        { table: "accounts", column: "issuer", isNullable: true },
      ],
      indexes: [{
        name: "accounts_provider_account_id_idx",
        definition: "CREATE UNIQUE INDEX accounts_provider_account_id_idx ON public.accounts USING btree (provider_id, account_id)",
        isValid: false,
      }],
      duplicateAccountIdentities: 0,
    });

    expect(preflight.state).toBe("blocked");
    expect(preflight.issues).toContain("SCHEMA_INDEX_INVALID:accounts_provider_account_id_idx");
    expect(preflight.issues).toContain("SCHEMA_COLUMN_DEFAULT_MISMATCH:entitlement_batches.refund_locked");
  });

  it("blocks the account identity migration when duplicate provider accounts exist", () => {
    const preflight = classifyProductionMigrationPreflight({
      refundIntegrityApplied: false,
      accountIdentityApplied: false,
      columns: [{ table: "accounts", column: "issuer", isNullable: false }],
      indexes: [{ name: "accounts_issuer_account_id_idx", definition: "CREATE UNIQUE INDEX accounts_issuer_account_id_idx ON public.accounts USING btree (issuer, account_id)" }],
      duplicateAccountIdentities: 2,
    });

    expect(preflight.state).toBe("blocked");
    expect(preflight.issues).toContain("ACCOUNT_IDENTITY_DUPLICATES_PRESENT:2");
  });

  it("blocks partial or drifted schema states", () => {
    const preflight = classifyProductionMigrationPreflight({
      refundIntegrityApplied: false,
      accountIdentityApplied: false,
      columns: [
        { table: "entitlement_batches", column: "refund_locked", isNullable: false },
        { table: "accounts", column: "issuer", isNullable: true },
      ],
      indexes: [],
      duplicateAccountIdentities: 0,
    });

    expect(preflight.state).toBe("blocked");
    expect(preflight.issues).toContain("SCHEMA_DRIFT_COLUMN_PRESENT:entitlement_batches.refund_locked");
    expect(preflight.issues).toContain("SCHEMA_COLUMN_STATE_MISMATCH:accounts.issuer:expected_not_null:actual_nullable");
    expect(preflight.issues).toContain("SCHEMA_DRIFT_LEGACY_ACCOUNT_INDEX_MISSING");
  });
});
