import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const castingLifecycle = pgEnum("casting_lifecycle", [
  "draft", "casting", "awaiting_reveal", "revealed", "expired", "cancelled",
  "discarded_duplicate", "emergency_blocked", "user_deleted",
]);
export const riskStatus = pgEnum("risk_status", [
  "not_checked", "allowed", "professional_decision_blocked", "needs_clarification", "emergency_blocked",
]);
export const previewStatus = pgEnum("preview_status", [
  "not_started", "queued", "generating", "completed", "failed", "blocked",
]);
export const readingStatus = pgEnum("reading_status", [
  "not_started", "reserved", "queued", "generating", "validating", "completed", "failed", "blocked",
]);
export const reservationStatus = pgEnum("reservation_status", ["reserved", "consumed", "released", "expired"]);
export const qualityReviewStatus = pgEnum("quality_review_status", [
  "not_started", "submitted", "supplementing", "in_review", "approved", "rejected",
]);
export const orderStatus = pgEnum("order_status", ["pending", "paid", "partially_refunded", "refunded", "disputed"]);
export const jobStatus = pgEnum("job_status", ["queued", "running", "completed", "failed", "timed_out"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt,
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt,
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("sessions_user_idx").on(table.userId),
  index("sessions_expiry_idx").on(table.expiresAt),
]);

export const castingSessions = pgTable("casting_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  anonymousSessionHash: text("anonymous_session_hash"),
  anonymousHashKeyVersion: text("anonymous_hash_key_version"),
  method: text("method").notNull(),
  lifecycle: castingLifecycle("lifecycle").notNull().default("draft"),
  riskStatus: riskStatus("risk_status").notNull().default("not_checked"),
  scene: text("scene").notNull(),
  interpretationGoal: text("interpretation_goal").notNull(),
  currentQuestionVersionId: text("current_question_version_id"),
  questionFingerprint: text("question_fingerprint"),
  fingerprintKeyVersion: text("fingerprint_key_version"),
  algorithmVersion: text("algorithm_version").notNull(),
  firstIrreversibleStepAt: timestamp("first_irreversible_step_at", { withTimezone: true }),
  castingExpiresAt: timestamp("casting_expires_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  revealExpiresAt: timestamp("reveal_expires_at", { withTimezone: true }),
  revealedAt: timestamp("revealed_at", { withTimezone: true }),
  duplicateOfCastingId: text("duplicate_of_casting_id"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  purgeAfter: timestamp("purge_after", { withTimezone: true }),
  createdAt,
  updatedAt,
}, (table) => [
  index("casting_sessions_user_idx").on(table.userId, table.createdAt),
  index("casting_sessions_anonymous_idx").on(table.anonymousSessionHash),
  uniqueIndex("casting_active_user_once_idx").on(table.userId).where(
    sql`${table.userId} is not null and ${table.lifecycle} in ('draft','casting','awaiting_reveal')`,
  ),
  uniqueIndex("casting_active_anonymous_once_idx").on(table.anonymousSessionHash).where(
    sql`${table.anonymousSessionHash} is not null and ${table.lifecycle} in ('draft','casting','awaiting_reveal')`,
  ),
  check("casting_owner_present_check", sql`${table.userId} is not null or ${table.anonymousSessionHash} is not null`),
]);

export const loginIntents = pgTable("login_intents", {
  id: text("id").primaryKey(),
  castingSessionId: text("casting_session_id").notNull().references(() => castingSessions.id, { onDelete: "cascade" }),
  anonymousSessionHash: text("anonymous_session_hash").notNull(),
  nonceHash: text("nonce_hash").notNull(),
  nonceKeyVersion: text("nonce_key_version").notNull(),
  allowedCallbackPath: text("allowed_callback_path").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt,
}, (table) => [
  index("login_intents_casting_idx").on(table.castingSessionId),
  index("login_intents_expiry_idx").on(table.expiresAt).where(sql`${table.consumedAt} is null`),
]);

export const questionVersions = pgTable("question_versions", {
  id: text("id").primaryKey(),
  castingSessionId: text("casting_session_id").notNull().references(() => castingSessions.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  encryptionKeyVersion: text("encryption_key_version").notNull(),
  createdReason: text("created_reason").notNull(),
  createdAt,
}, (table) => [
  uniqueIndex("question_version_once_idx").on(table.castingSessionId, table.versionNumber),
]);

export const castingRiskDecisions = pgTable("casting_risk_decisions", {
  castingSessionId: text("casting_session_id").primaryKey().references(() => castingSessions.id, { onDelete: "cascade" }),
  ruleVersion: text("rule_version").notNull(),
  matchedRuleCodes: jsonb("matched_rule_codes").notNull().default(sql`'[]'::jsonb`),
  reasonCode: text("reason_code").notNull(),
  status: riskStatus("status").notNull(),
  createdAt,
});

export const castingSteps = pgTable("casting_steps", {
  id: text("id").primaryKey(),
  castingSessionId: text("casting_session_id").notNull().references(() => castingSessions.id, { onDelete: "cascade" }),
  stepKind: text("step_kind").notNull(),
  lineIndex: integer("line_index").notNull(),
  changeIndex: integer("change_index"),
  rawRecord: jsonb("raw_record").notNull(),
  lineValue: integer("line_value"),
  algorithmVersion: text("algorithm_version").notNull(),
  createdAt,
}, (table) => [
  uniqueIndex("casting_step_once_idx").on(
    table.castingSessionId,
    table.stepKind,
    table.lineIndex,
    sql`coalesce(${table.changeIndex}, -1)`,
  ),
  index("casting_steps_casting_idx").on(table.castingSessionId, table.lineIndex, table.changeIndex),
]);

export const castResults = pgTable("cast_results", {
  castingSessionId: text("casting_session_id").primaryKey().references(() => castingSessions.id, { onDelete: "cascade" }),
  lineValues: jsonb("line_values").notNull(),
  primaryHexagramNumber: integer("primary_hexagram_number").notNull(),
  movingLinePositions: jsonb("moving_line_positions").notNull().default(sql`'[]'::jsonb`),
  relatingHexagramNumber: integer("relating_hexagram_number"),
  methodCalculation: jsonb("method_calculation").notNull(),
  resultHmac: text("result_hmac").notNull(),
  algorithmVersion: text("algorithm_version").notNull(),
  classicMappingVersion: text("classic_mapping_version").notNull(),
  createdAt,
});

export const questionLocks = pgTable("question_locks", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  questionFingerprint: text("question_fingerprint").notNull(),
  fingerprintKeyVersion: text("fingerprint_key_version").notNull(),
  winningCastingId: text("winning_casting_id").notNull().references(() => castingSessions.id, { onDelete: "cascade" }),
  lockedUntil: timestamp("locked_until", { withTimezone: true }).notNull(),
  createdAt,
  updatedAt,
}, (table) => [
  primaryKey({ columns: [table.userId, table.questionFingerprint, table.fingerprintKeyVersion] }),
  index("question_locks_active_user_idx").on(table.userId, table.lockedUntil),
]);

export const previews = pgTable("previews", {
  id: text("id").primaryKey(),
  castingSessionId: text("casting_session_id").notNull().unique().references(() => castingSessions.id, { onDelete: "cascade" }),
  status: previewStatus("status").notNull().default("not_started"),
  relevanceStatement: text("relevance_statement"),
  schemaVersion: text("schema_version").notNull(),
  createdAt,
  updatedAt,
});

export const readings = pgTable("readings", {
  id: text("id").primaryKey(),
  castingSessionId: text("casting_session_id").notNull().unique().references(() => castingSessions.id, { onDelete: "cascade" }),
  status: readingStatus("status").notNull().default("not_started"),
  reservationId: text("reservation_id"),
  report: jsonb("report"),
  schemaVersion: text("schema_version").notNull(),
  generationEpoch: integer("generation_epoch").notNull().default(0),
  createdAt,
  updatedAt,
});

export const entitlementBatches = pgTable("entitlement_batches", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  orderId: text("order_id").unique().references(() => orders.id, { onDelete: "restrict" }),
  amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull(),
  quantityTotal: integer("quantity_total").notNull(),
  quantityAvailable: integer("quantity_available").notNull(),
  quantityReserved: integer("quantity_reserved").notNull(),
  quantityConsumed: integer("quantity_consumed").notNull(),
  quantityRevoked: integer("quantity_revoked").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt,
  updatedAt,
}, (table) => [
  index("entitlement_batches_fifo_idx").on(table.userId, table.expiresAt, table.createdAt).where(
    sql`${table.quantityAvailable} > 0`,
  ),
  check("entitlement_batch_identity_check", sql`
    ${table.quantityAvailable} >= 0 and ${table.quantityReserved} >= 0 and
    ${table.quantityConsumed} >= 0 and ${table.quantityRevoked} >= 0 and
    ${table.quantityAvailable} + ${table.quantityReserved} + ${table.quantityConsumed} + ${table.quantityRevoked} = ${table.quantityTotal}
  `),
]);

export const entitlementLedger = pgTable("entitlement_ledger", {
  id: text("id").primaryKey(),
  batchId: text("batch_id").notNull().references(() => entitlementBatches.id, { onDelete: "cascade" }),
  orderId: text("order_id").references(() => orders.id, { onDelete: "restrict" }),
  webhookEventId: text("webhook_event_id"),
  action: text("action").notNull(),
  quantity: integer("quantity").notNull(),
  readingId: text("reading_id"),
  reservationId: text("reservation_id"),
  reasonCode: text("reason_code"),
  createdAt,
}, (table) => [index("entitlement_ledger_batch_idx").on(table.batchId, table.createdAt)]);

export const reservations = pgTable("reservations", {
  id: text("id").primaryKey(),
  readingId: text("reading_id").notNull().unique().references(() => readings.id, { onDelete: "cascade" }),
  batchId: text("batch_id").notNull().references(() => entitlementBatches.id, { onDelete: "restrict" }),
  status: reservationStatus("status").notNull().default("reserved"),
  createdAt,
  updatedAt,
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  productId: text("product_id").notNull(),
  amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  requestId: text("request_id").notNull().unique(),
  providerCheckoutId: text("provider_checkout_id").unique(),
  providerOrderId: text("provider_order_id").unique(),
  providerTransactionId: text("provider_transaction_id").unique(),
  providerAmountMinor: integer("provider_amount_minor"),
  refundedAmountMinor: integer("refunded_amount_minor").notNull().default(0),
  financialReviewRequired: boolean("financial_review_required").notNull().default(false),
  lastProviderEventAt: timestamp("last_provider_event_at", { withTimezone: true }),
  buyerEmailSnapshot: text("buyer_email_snapshot"),
  providerSubtotalMinor: integer("provider_subtotal_minor"),
  providerTaxAmountMinor: integer("provider_tax_amount_minor"),
  providerTotalMinor: integer("provider_total_minor"),
  status: orderStatus("status").notNull().default("pending"),
  createdAt,
  updatedAt,
}, (table) => [index("orders_user_idx").on(table.userId, table.createdAt)]);

export const qualityReviews = pgTable("quality_reviews", {
  id: text("id").primaryKey(),
  readingId: text("reading_id").notNull().unique().references(() => readings.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: qualityReviewStatus("status").notNull().default("submitted"),
  reason: text("reason"),
  responseDueAt: timestamp("response_due_at", { withTimezone: true }).notNull(),
  supplementedAt: timestamp("supplemented_at", { withTimezone: true }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  compensationBatchId: text("compensation_batch_id").references(() => entitlementBatches.id, { onDelete: "set null" }),
  createdAt,
  updatedAt,
});

export const generationJobs = pgTable("generation_jobs", {
  id: text("id").primaryKey(),
  castingSessionId: text("casting_session_id").notNull().references(() => castingSessions.id, { onDelete: "cascade" }),
  readingId: text("reading_id").references(() => readings.id, { onDelete: "cascade" }),
  jobType: text("job_type").notNull(),
  status: jobStatus("status").notNull().default("queued"),
  generationEpoch: integer("generation_epoch").notNull().default(0),
  snapshot: jsonb("snapshot").notNull(),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  timeoutAt: timestamp("timeout_at", { withTimezone: true }).notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastErrorCode: text("last_error_code"),
  createdAt,
  updatedAt,
}, (table) => [
  index("generation_jobs_claim_idx").on(table.status, table.availableAt, table.createdAt),
  uniqueIndex("generation_job_epoch_once_idx").on(table.castingSessionId, table.jobType, table.generationEpoch),
]);

export const outbox = pgTable("outbox", {
  id: text("id").primaryKey(),
  topic: text("topic").notNull(),
  aggregateId: text("aggregate_id"),
  payload: jsonb("payload").notNull(),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true }),
  lastErrorCode: text("last_error_code"),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt,
}, (table) => [index("outbox_dispatch_idx").on(table.dispatchedAt, table.availableAt, table.createdAt)]);

export const webhookInbox = pgTable("webhook_inbox", {
  provider: text("provider").notNull(),
  deliveryId: text("delivery_id").notNull(),
  eventId: text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  mode: text("mode"),
  storeId: text("store_id"),
  orderId: text("order_id").references(() => orders.id, { onDelete: "restrict" }),
  payload: jsonb("payload").notNull(),
  signatureVerifiedAt: timestamp("signature_verified_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  processingErrorCode: text("processing_error_code"),
  createdAt,
}, (table) => [
  primaryKey({ columns: [table.provider, table.deliveryId] }),
  uniqueIndex("webhook_inbox_provider_delivery_once_idx").on(table.provider, table.deliveryId),
  uniqueIndex("webhook_inbox_provider_event_once_idx").on(table.provider, table.eventType, table.eventId),
]);
