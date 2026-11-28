export const CURRENT_REQUIRED_SCHEMA_OBJECTS = Object.freeze([
  "table:deep_reading_context_snapshots",
  "column:generation_output_reviews.question_relevance_pass",
  "column:generation_output_reviews.context_fidelity_pass",
  "column:generation_output_reviews.evidence_grounding_pass",
  "column:generation_output_reviews.interpretive_coherence_pass",
  "column:generation_output_reviews.actionability_pass",
  "column:generation_output_reviews.uncertainty_pass",
  "column:generation_output_reviews.language_consistency_pass",
  "constraint:deep_reading_context_snapshots.deep_reading_context_snapshots_pkey",
  "constraint:generation_output_reviews.generation_reviews_deep_reading_pass_fields_check",
  "foreign_key:deep_reading_context_snapshots.casting_id->casting_sessions.id:cascade",
  "trigger:deep_reading_context_snapshots.deep_reading_context_snapshot_immutable_trigger",
  "function:prevent_deep_reading_context_snapshot_update",
] as const);

export type ProductionEnvironmentEntry = {
  key?: unknown;
  target?: unknown;
  value?: unknown;
  id?: unknown;
};

type DecryptedEnvironmentValue = {
  key?: unknown;
  value?: unknown;
  decrypted?: unknown;
};

function targetsProduction(target: unknown): boolean {
  return target === "production" || (Array.isArray(target) && target.includes("production"));
}

function postgresUrl(value: unknown): value is string {
  return typeof value === "string" && /^postgres(?:ql)?:\/\//i.test(value.trim());
}

export function requireProductionDatabaseUrl(value: unknown): string {
  if (!postgresUrl(value)) throw new Error("PRODUCTION_DATABASE_URL_INVALID");
  return value.trim();
}

export async function resolveProductionDatabaseUrl(
  entries: readonly ProductionEnvironmentEntry[],
  readDecryptedValue: (environmentId: string) => Promise<DecryptedEnvironmentValue>,
): Promise<string> {
  const databaseEntries = entries.filter((entry) => entry.key === "DATABASE_URL" && targetsProduction(entry.target));
  if (databaseEntries.length !== 1) throw new Error(`PRODUCTION_DATABASE_URL_COUNT_INVALID:${databaseEntries.length}`);

  const entry = databaseEntries[0]!;
  if (postgresUrl(entry.value)) return entry.value.trim();
  if (typeof entry.id !== "string" || !entry.id.trim()) throw new Error("PRODUCTION_DATABASE_URL_UNREADABLE");

  const decrypted = await readDecryptedValue(entry.id.trim());
  if (decrypted.key !== "DATABASE_URL" || decrypted.decrypted !== true) {
    throw new Error("PRODUCTION_DATABASE_URL_NOT_DECRYPTED");
  }
  if (!postgresUrl(decrypted.value)) throw new Error("PRODUCTION_DATABASE_URL_UNREADABLE");
  return decrypted.value.trim();
}

export type CurrentSchemaState = "complete" | "partial";

export function classifyCurrentSchema(existingObjects: readonly string[]): {
  state: CurrentSchemaState;
  present: string[];
  missing: string[];
} {
  const existing = new Set(existingObjects);
  const present = CURRENT_REQUIRED_SCHEMA_OBJECTS.filter((object) => existing.has(object));
  const missing = CURRENT_REQUIRED_SCHEMA_OBJECTS.filter((object) => !existing.has(object));
  return {
    state: missing.length > 0 ? "partial" : "complete",
    present: [...present],
    missing: [...missing],
  };
}
export function classifyAppliedMigrationHistory(
  applied: readonly { createdAt: number; hash: string }[],
  expected: readonly { createdAt: number; hash: string }[],
): "pending" | "complete" | "invalid" {
  if (applied.length > expected.length) return "invalid";
  for (let index = 0; index < applied.length; index += 1) {
    const current = applied[index];
    const next = expected[index];
    if (!current || !next || current.createdAt !== next.createdAt || current.hash !== next.hash) return "invalid";
  }
  return applied.length === expected.length ? "complete" : "pending";
}

export type RecoveryPostureEvidence = {
  managedBackupProvider: boolean;
  archiveMode: string | null;
  walArchivingObserved: boolean | null;
};

export type RecoveryPostureAssessment = {
  recoveryConfirmed: boolean;
  recoveryEvidence:
    | "WAL_ARCHIVING_OBSERVED"
    | "WAL_ARCHIVING_DISABLED"
    | "WAL_ARCHIVING_NOT_OBSERVED"
    | "WAL_ARCHIVING_UNREADABLE";
};

export function assessRecoveryPosture(evidence: RecoveryPostureEvidence): RecoveryPostureAssessment {
  if (evidence.archiveMode === "off") {
    return { recoveryConfirmed: false, recoveryEvidence: "WAL_ARCHIVING_DISABLED" };
  }
  if (evidence.walArchivingObserved === true) {
    return { recoveryConfirmed: true, recoveryEvidence: "WAL_ARCHIVING_OBSERVED" };
  }
  return {
    recoveryConfirmed: false,
    recoveryEvidence: evidence.walArchivingObserved === null
      ? "WAL_ARCHIVING_UNREADABLE"
      : "WAL_ARCHIVING_NOT_OBSERVED",
  };
}

export type ProductionSchemaColumn = {
  table: string;
  column: string;
  isNullable: boolean;
  columnDefault?: string | null;
};

export type ProductionSchemaIndex = {
  name: string;
  definition: string;
  isValid?: boolean;
};

export type ProductionMigrationPreflightInput = {
  refundIntegrityApplied: boolean;
  accountIdentityApplied: boolean;
  columns: readonly ProductionSchemaColumn[];
  indexes: readonly ProductionSchemaIndex[];
  duplicateAccountIdentities: number;
};

export type ProductionMigrationPreflight = {
  state: "ready" | "blocked";
  issues: string[];
  checks: Record<string, boolean>;
};

export function classifyProductionMigrationPreflight(
  input: ProductionMigrationPreflightInput,
): ProductionMigrationPreflight {
  const columns = new Map(
    input.columns.map((column) => [`${column.table}.${column.column}`, column]),
  );
  const indexes = new Map(input.indexes.map((index) => [index.name, index]));
  const checks: Record<string, boolean> = {};
  const issues: string[] = [];

  const expectColumn = (name: string, expected: "absent" | "nullable" | "not_null"): void => {
    const actual = columns.get(name);
    const present = Boolean(actual);
    const matches = expected === "absent"
      ? !present
      : present && actual!.isNullable === (expected === "nullable");
    checks[`column:${name}`] = matches;
    if (matches) return;
    if (expected === "absent") {
      issues.push(`SCHEMA_DRIFT_COLUMN_PRESENT:${name}`);
      return;
    }
    const actualState = !present ? "absent" : actual!.isNullable ? "nullable" : "not_null";
    issues.push(`SCHEMA_COLUMN_STATE_MISMATCH:${name}:expected_${expected}:actual_${actualState}`);
  };

  expectColumn("entitlement_batches.refund_locked", input.refundIntegrityApplied ? "not_null" : "absent");
  expectColumn("refund_intents.decision_operator_id", input.refundIntegrityApplied ? "nullable" : "absent");
  expectColumn("refund_intents.dispatch_operator_id", input.refundIntegrityApplied ? "nullable" : "absent");
  expectColumn("accounts.issuer", input.accountIdentityApplied ? "nullable" : "not_null");

  const refundLocked = columns.get("entitlement_batches.refund_locked");
  if (input.refundIntegrityApplied && refundLocked && refundLocked.columnDefault !== undefined) {
    const defaultFalse = /false/i.test(refundLocked.columnDefault ?? "");
    checks["default:entitlement_batches.refund_locked"] = defaultFalse;
    if (!defaultFalse) issues.push("SCHEMA_COLUMN_DEFAULT_MISMATCH:entitlement_batches.refund_locked");
  }

  const legacyIndex = indexes.get("accounts_issuer_account_id_idx");
  const identityIndex = indexes.get("accounts_provider_account_id_idx");
  checks["index:accounts_issuer_account_id_idx"] = input.accountIdentityApplied
    ? !legacyIndex
    : Boolean(legacyIndex);
  checks["index:accounts_provider_account_id_idx"] = Boolean(identityIndex);
  if (input.accountIdentityApplied && legacyIndex) issues.push("SCHEMA_DRIFT_LEGACY_ACCOUNT_INDEX_PRESENT");
  if (!input.accountIdentityApplied && !legacyIndex) issues.push("SCHEMA_DRIFT_LEGACY_ACCOUNT_INDEX_MISSING");
  if (identityIndex) {
    const unique = /unique/i.test(identityIndex.definition);
    const columnsMatch = /\(provider_id, account_id\)/i.test(identityIndex.definition);
    const valid = identityIndex.isValid !== false;
    checks["unique_index:accounts_provider_account_id"] = unique && columnsMatch && valid;
    if (!unique || !columnsMatch) issues.push("SCHEMA_INDEX_DEFINITION_MISMATCH:accounts_provider_account_id_idx");
    if (!valid) issues.push("SCHEMA_INDEX_INVALID:accounts_provider_account_id_idx");
  } else if (input.accountIdentityApplied) {
    checks["unique_index:accounts_provider_account_id"] = false;
    issues.push("SCHEMA_UNIQUE_INDEX_MISSING:accounts_provider_account_id_idx");
  }
  if (!input.accountIdentityApplied && identityIndex) {
    issues.push("SCHEMA_DRIFT_ACCOUNT_IDENTITY_INDEX_PRESENT");
  }

  checks["duplicate_account_identities_absent"] = input.duplicateAccountIdentities === 0;
  if (input.duplicateAccountIdentities !== 0) {
    issues.push(`ACCOUNT_IDENTITY_DUPLICATES_PRESENT:${input.duplicateAccountIdentities}`);
  }

  return {
    state: issues.length === 0 ? "ready" : "blocked",
    issues,
    checks,
  };
}
