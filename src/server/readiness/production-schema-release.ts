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

export const RETIRED_SCHEMA_OBJECTS = Object.freeze([
  "table:question_locks",
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

export type CurrentSchemaState = "pending" | "complete" | "partial";

export function classifyCurrentSchema(existingObjects: readonly string[]): {
  state: CurrentSchemaState;
  present: string[];
  missing: string[];
  retiredPresent: string[];
} {
  const existing = new Set(existingObjects);
  const present = CURRENT_REQUIRED_SCHEMA_OBJECTS.filter((object) => existing.has(object));
  const missing = CURRENT_REQUIRED_SCHEMA_OBJECTS.filter((object) => !existing.has(object));
  const retiredPresent = RETIRED_SCHEMA_OBJECTS.filter((object) => existing.has(object));
  return {
    state: missing.length > 0 ? "partial" : retiredPresent.length > 0 ? "pending" : "complete",
    present: [...present],
    missing: [...missing],
    retiredPresent: [...retiredPresent],
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
