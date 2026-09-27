export const MIGRATION_0012_REQUIRED_OBJECTS = Object.freeze([
  "table:question_locks",
  "table:deep_reading_context_snapshots",
  "column:generation_output_reviews.question_relevance_pass",
  "column:generation_output_reviews.context_fidelity_pass",
  "column:generation_output_reviews.evidence_grounding_pass",
  "column:generation_output_reviews.interpretive_coherence_pass",
  "column:generation_output_reviews.actionability_pass",
  "column:generation_output_reviews.uncertainty_pass",
  "column:generation_output_reviews.language_consistency_pass",
  "index:question_locks.question_locks_winning_casting_idx",
  "index:question_locks.question_locks_locked_until_idx",
  "constraint:question_locks.question_locks_pkey",
  "constraint:deep_reading_context_snapshots.deep_reading_context_snapshots_pkey",
  "constraint:generation_output_reviews.generation_reviews_deep_reading_pass_fields_check",
  "foreign_key:question_locks.user_id->users.id:cascade",
  "foreign_key:question_locks.winning_casting_id->casting_sessions.id:cascade",
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

export type Migration0012SchemaState = "pending" | "complete" | "partial";

export function classifyMigration0012Schema(existingObjects: readonly string[]): {
  state: Migration0012SchemaState;
  present: string[];
  missing: string[];
} {
  const existing = new Set(existingObjects);
  const present = MIGRATION_0012_REQUIRED_OBJECTS.filter((object) => existing.has(object));
  const missing = MIGRATION_0012_REQUIRED_OBJECTS.filter((object) => !existing.has(object));
  return {
    state: present.length === 0 ? "pending" : missing.length === 0 ? "complete" : "partial",
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
  if (applied.length === expected.length) return "complete";
  return applied.length === expected.length - 1 ? "pending" : "invalid";
}
