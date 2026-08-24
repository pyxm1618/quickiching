import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth-schema";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const commercialCastingLifecycle = pgEnum("commercial_casting_lifecycle", [
  "draft",
  "casting",
  "awaiting_reveal",
  "revealed",
  "expired",
  "discarded_duplicate",
  "emergency_blocked",
  "user_deleted",
]);

export const generationKind = pgEnum("generation_kind", ["preview", "deep_reading"]);
export const generationJobStatus = pgEnum("generation_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "timed_out",
  "dead_letter",
]);
export const outputReviewStatus = pgEnum("output_review_status", ["pass", "fail"]);

export const castingSessions = pgTable(
  "casting_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "restrict" }),
    method: text("method").notNull(),
    lifecycle: commercialCastingLifecycle("lifecycle").notNull().default("draft"),
    riskStatus: text("risk_status").notNull().default("not_checked"),
    riskRuleVersion: text("risk_rule_version"),
    scene: text("scene").notNull(),
    interpretationGoal: text("interpretation_goal").notNull(),
    questionFingerprint: text("question_fingerprint"),
    fingerprintKeyVersion: text("fingerprint_key_version"),
    generationEpoch: integer("generation_epoch").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("casting_sessions_user_idx").on(table.userId),
    check("casting_sessions_risk_status_check", sql`${table.riskStatus} in ('not_checked', 'allowed', 'professional_decision_blocked', 'needs_clarification', 'emergency_blocked')`),
    check("casting_sessions_generation_epoch_check", sql`${table.generationEpoch} >= 0`),
  ],
);

export const questionVersions = pgTable(
  "question_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    castingId: uuid("casting_id").notNull().references(() => castingSessions.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    encryptionKeyVersion: text("encryption_key_version").notNull(),
    fingerprintKeyVersion: text("fingerprint_key_version").notNull(),
    fingerprint: text("fingerprint").notNull(),
    createdReason: text("created_reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("question_versions_casting_version_idx").on(table.castingId, table.versionNumber),
    index("question_versions_fingerprint_idx").on(table.fingerprint),
    check("question_versions_version_positive_check", sql`${table.versionNumber} > 0`),
  ],
);

export const castResults = pgTable(
  "cast_results",
  {
    castingId: uuid("casting_id").primaryKey().references(() => castingSessions.id, { onDelete: "cascade" }),
    lineValues: integer("line_values").array().notNull(),
    primaryHexagramNumber: integer("primary_hexagram_number").notNull(),
    movingLinePositions: integer("moving_line_positions").array().notNull(),
    relatingHexagramNumber: integer("relating_hexagram_number"),
    methodCalculation: jsonb("method_calculation").notNull(),
    algorithmVersion: text("algorithm_version").notNull(),
    classicMappingVersion: text("classic_mapping_version").notNull(),
    resultHmac: text("result_hmac").notNull(),
    resultHmacKeyVersion: text("result_hmac_key_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("cast_results_six_lines_check", sql`cardinality(${table.lineValues}) = 6`),
    check("cast_results_line_values_check", sql`${table.lineValues} <@ ARRAY[6, 7, 8, 9]::integer[]`),
    check("cast_results_primary_hexagram_check", sql`${table.primaryHexagramNumber} between 1 and 64`),
    check("cast_results_relating_hexagram_check", sql`${table.relatingHexagramNumber} is null or ${table.relatingHexagramNumber} between 1 and 64`),
  ],
);

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    castingId: uuid("casting_id").notNull().references(() => castingSessions.id, { onDelete: "cascade" }),
    kind: generationKind("kind").notNull(),
    status: generationJobStatus("status").notNull().default("queued"),
    generationEpoch: integer("generation_epoch").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    inputSnapshotHash: text("input_snapshot_hash").notNull(),
    timeoutAt: timestamp("timeout_at", { withTimezone: true }).notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    leaseOwner: text("lease_owner"),
    leaseToken: text("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    modelIdentifier: text("model_identifier"),
    providerRequestIdentifier: text("provider_request_identifier"),
    tokenUsage: jsonb("token_usage"),
    costMetadata: jsonb("cost_metadata"),
    structuredErrorCode: text("structured_error_code"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("generation_jobs_idempotency_idx").on(table.idempotencyKey),
    uniqueIndex("generation_jobs_active_kind_idx")
      .on(table.castingId, table.kind)
      .where(sql`${table.status} in ('queued', 'running')`),
    index("generation_jobs_lease_idx").on(table.status, table.leaseExpiresAt),
    check("generation_jobs_epoch_check", sql`${table.generationEpoch} >= 0`),
    check("generation_jobs_attempt_count_check", sql`${table.attemptCount} >= 0`),
  ],
);

export const generationAttempts = pgTable(
  "generation_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").notNull().references(() => generationJobs.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    retryClassification: text("retry_classification").notNull(),
    timeoutCode: text("timeout_code"),
    errorCode: text("error_code"),
  },
  (table) => [
    uniqueIndex("generation_attempts_job_attempt_idx").on(table.jobId, table.attemptNumber),
    check("generation_attempts_number_positive_check", sql`${table.attemptNumber} > 0`),
  ],
);

export const previewResults = pgTable(
  "preview_results",
  {
    castingId: uuid("casting_id").primaryKey().references(() => castingSessions.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").notNull().unique().references(() => generationJobs.id, { onDelete: "restrict" }),
    output: jsonb("output").notNull(),
    schemaVersion: text("schema_version").notNull(),
    promptVersion: text("prompt_version").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    integrityHash: text("integrity_hash").notNull(),
    persistedAt: timestamp("persisted_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const generationOutputReviews = pgTable(
  "generation_output_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").notNull().unique().references(() => generationJobs.id, { onDelete: "cascade" }),
    castingId: uuid("casting_id").notNull().references(() => castingSessions.id, { onDelete: "cascade" }),
    kind: generationKind("kind").notNull(),
    status: outputReviewStatus("status").notNull(),
    reasonCodes: jsonb("reason_codes").notNull(),
    reviewerModelVersion: text("reviewer_model_version").notNull(),
    schemaValid: text("schema_valid").notNull(),
    safetyPass: text("safety_pass").notNull(),
    factConsistencyPass: text("fact_consistency_pass").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("generation_reviews_boolean_fields_check", sql`${table.schemaValid} in ('true', 'false') and ${table.safetyPass} in ('true', 'false') and ${table.factConsistencyPass} in ('true', 'false')`),
    check("generation_reviews_pass_fields_check", sql`${table.status} <> 'pass' or (${table.schemaValid} = 'true' and ${table.safetyPass} = 'true' and ${table.factConsistencyPass} = 'true')`),
  ],
);

export const generationSchema = Object.freeze({
  castingSessions,
  questionVersions,
  castResults,
  generationJobs,
  generationAttempts,
  previewResults,
  generationOutputReviews,
});

export type GenerationSchema = typeof generationSchema;
