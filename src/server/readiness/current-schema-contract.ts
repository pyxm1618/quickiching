import migrationIntegrity from "../../../drizzle/migration-integrity.json";

export const CURRENT_SCHEMA_MIGRATION = Object.freeze(
  migrationIntegrity.migrations.at(-1) ?? (() => { throw new Error("CURRENT_SCHEMA_MIGRATION_MISSING"); })(),
);

export const CURRENT_SCHEMA_REQUIRED_TABLES = Object.freeze([
  "users",
  "sessions",
  "accounts",
  "verifications",
  "login_intents",
  "casting_sessions",
  "question_versions",
  "cast_results",
  "generation_jobs",
  "generation_attempts",
  "preview_results",
  "generation_output_reviews",
  "deep_reading_results",
  "payment_orders",
  "payment_webhook_inbox",
  "payment_outbox",
  "entitlement_batches",
  "entitlement_ledger",
  "entitlement_reservations",
  "payment_checkout_budgets",
  "payment_financial_reviews",
  "payment_webhook_conflicts",
  "workflow_runs",
  "audit_events",
  "question_locks",
  "deep_reading_context_snapshots",
] as const);

// Objects introduced/changed by the current latest migration. This is intentionally
// named by role, not migration number: when a forward migration becomes latest,
// update this contract in the same migration PR.
export const CURRENT_MIGRATION_REQUIRED_OBJECTS = Object.freeze([
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
