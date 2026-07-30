import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const castingLifecycle = pgEnum("casting_lifecycle", [
  "draft",
  "casting",
  "awaiting_reveal",
  "revealed",
  "expired",
  "cancelled",
  "discarded_duplicate",
  "emergency_blocked",
  "user_deleted",
]);
export const riskStatus = pgEnum("risk_status", [
  "not_checked",
  "allowed",
  "professional_decision_blocked",
  "needs_clarification",
  "emergency_blocked",
]);
export const previewStatus = pgEnum("preview_status", [
  "not_started",
  "queued",
  "generating",
  "completed",
  "failed",
  "blocked",
]);
export const readingStatus = pgEnum("reading_status", [
  "not_started",
  "reserved",
  "queued",
  "generating",
  "validating",
  "completed",
  "failed",
  "blocked",
]);
export const reservationStatus = pgEnum("reservation_status", [
  "reserved",
  "consumed",
  "released",
  "expired",
]);
export const qualityReviewStatus = pgEnum("quality_review_status", [
  "not_started",
  "submitted",
  "supplementing",
  "in_review",
  "approved",
  "rejected",
]);
export const jobStatus = pgEnum("job_status", [
  "queued",
  "running",
  "validating",
  "completed",
  "failed",
  "timed_out",
  "cancelled",
]);
export const jobTarget = pgEnum("job_target", ["preview", "reading"]);
export const orderStatus = pgEnum("order_status", [
  "pending",
  "paid",
  "refunded",
  "disputed",
]);
export const ledgerAction = pgEnum("ledger_action", [
  "grant",
  "freeze",
  "consume",
  "release",
  "expire",
  "revoke",
  "compensate",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name"),
  image: text("image"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("user_email_unique").on(sql`lower(${table.email})`),
]);

export const authSessions = pgTable("auth_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  ...timestamps,
}, (table) => [
  uniqueIndex("auth_session_token_unique").on(table.tokenHash),
  index("auth_session_user_idx").on(table.userId),
]);

export const authAccounts = pgTable("auth_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull(),
  accountId: text("account_id").notNull(),
  accessTokenCiphertext: text("access_token_ciphertext"),
  refreshTokenCiphertext: text("refresh_token_ciphertext"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  ...timestamps,
}, (table) => [
  uniqueIndex("auth_provider_account_unique").on(table.providerId, table.accountId),
  index("auth_account_user_idx").on(table.userId),
]);

export const authVerificationTokens = pgTable("auth_verification_tokens", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("auth_verification_token_unique").on(table.tokenHash),
  index("auth_verification_identifier_idx").on(table.identifier),
]);

export const castingSessions = pgTable("casting_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "restrict" }),
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
  ...timestamps,
}, (table) => [
  uniqueIndex("casting_active_user_unique")
    .on(table.userId)
    .where(sql`${table.userId} is not null and ${table.deletedAt} is null and ${table.lifecycle} in ('draft','casting','awaiting_reveal')`),
  uniqueIndex("casting_active_anonymous_unique")
    .on(table.anonymousSessionHash)
    .where(sql`${table.anonymousSessionHash} is not null and ${table.deletedAt} is null and ${table.lifecycle} in ('draft','casting','awaiting_reveal')`),
  index("casting_user_history_idx").on(table.userId, table.createdAt),
  index("casting_purge_due_idx").on(table.purgeAfter).where(sql`${table.purgeAfter} is not null`),
  check("casting_owner_present", sql`${table.userId} is not null or ${table.anonymousSessionHash} is not null`),
]);

export const questionVersions = pgTable("question_versions", {
  id: text("id").primaryKey(),
  castingId: text("casting_id").notNull().references(() => castingSessions.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  encryptionKeyVersion: text("encryption_key_version").notNull(),
  createdReason: text("created_reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("question_version_number_unique").on(table.castingId, table.versionNumber),
  index("question_version_casting_idx").on(table.castingId),
  check("question_version_positive", sql`${table.versionNumber} > 0`),
]);

export const riskChecks = pgTable("risk_checks", {
  id: text("id").primaryKey(),
  castingId: text("casting_id").notNull().references(() => castingSessions.id, { onDelete: "cascade" }),
  questionVersionId: text("question_version_id").notNull().references(() => questionVersions.id, { onDelete: "cascade" }),
  ruleVersion: text("rule_version").notNull(),
  matchedRuleCodes: jsonb("matched_rule_codes").$type<string[]>().notNull(),
  reasonCode: text("reason_code").notNull(),
  status: riskStatus("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("risk_check_casting_created_idx").on(table.castingId, table.createdAt),
]);

export const castingSteps = pgTable("casting_steps", {
  id: text("id").primaryKey(),
  castingId: text("casting_id").notNull().references(() => castingSessions.id, { onDelete: "cascade" }),
  stepKind: text("step_kind").notNull(),
  lineIndex: integer("line_index").notNull(),
  changeIndex: integer("change_index"),
  rawRecord: jsonb("raw_record").notNull(),
  lineValue: integer("line_value"),
  algorithmVersion: text("algorithm_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("casting_step_without_change_unique")
    .on(table.castingId, table.stepKind, table.lineIndex)
    .where(sql`${table.changeIndex} is null`),
  uniqueIndex("casting_yarrow_change_unique")
    .on(table.castingId, table.lineIndex, table.changeIndex)
    .where(sql`${table.stepKind} = 'yarrow_change' and ${table.changeIndex} is not null`),
  index("casting_step_order_idx").on(table.castingId, table.lineIndex, table.changeIndex),
  check("casting_step_line_range", sql`${table.lineIndex} between 0 and 5`),
  check("casting_step_change_range", sql`${table.changeIndex} is null or ${table.changeIndex} between 0 and 2`),
  check("casting_step_line_value", sql`${table.lineValue} is null or ${table.lineValue} in (6,7,8,9)`),
]);

export const castResults = pgTable("cast_results", {
  castingId: text("casting_id").notNull().references(() => castingSessions.id, { onDelete: "cascade" }),
  lineValues: jsonb("line_values").$type<number[]>().notNull(),
  primaryHexagramNumber: integer("primary_hexagram_number").notNull(),
  movingLinePositions: jsonb("moving_line_positions").$type<number[]>().notNull(),
  relatingHexagramNumber: integer("relating_hexagram_number"),
  methodCalculation: jsonb("method_calculation").notNull(),
  resultHmac: text("result_hmac").notNull(),
  algorithmVersion: text("algorithm_version").notNull(),
  classicMappingVersion: text("classic_mapping_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ name: "cast_results_pk", columns: [table.castingId] }),
  check("cast_result_primary_range", sql`${table.primaryHexagramNumber} between 1 and 64`),
  check("cast_result_relating_range", sql`${table.relatingHexagramNumber} is null or ${table.relatingHexagramNumber} between 1 and 64`),
]);

export const loginIntents = pgTable("login_intents", {
  id: text("id").primaryKey(),
  castingId: text("casting_id").notNull().references(() => castingSessions.id, { onDelete: "cascade" }),
  anonymousSessionHash: text("anonymous_session_hash").notNull(),
  nonceHash: text("nonce_hash").notNull(),
  nonceKeyVersion: text("nonce_key_version").notNull(),
  allowedCallbackPath: text("allowed_callback_path").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("login_intent_nonce_unique").on(table.nonceKeyVersion, table.nonceHash),
  index("login_intent_casting_idx").on(table.castingId),
  index("login_intent_expiry_idx").on(table.expiresAt).where(sql`${table.consumedAt} is null`),
]);

export const questionLocks = pgTable("question_locks", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  questionFingerprint: text("question_fingerprint").notNull(),
  fingerprintKeyVersion: text("fingerprint_key_version").notNull(),
  winningCastingId: text("winning_casting_id").notNull().references(() => castingSessions.id, { onDelete: "restrict" }),
  lockedUntil: timestamp("locked_until", { withTimezone: true }).notNull(),
  ...timestamps,
}, (table) => [
  primaryKey({
    name: "question_locks_pk",
    columns: [table.userId, table.questionFingerprint, table.fingerprintKeyVersion],
  }),
  index("question_lock_expiry_idx").on(table.lockedUntil),
]);

export const previews = pgTable("previews", {
  id: text("id").primaryKey(),
  castingId: text("casting_id").notNull().references(() => castingSessions.id, { onDelete: "cascade" }),
  status: previewStatus("status").notNull().default("not_started"),
  relevanceStatement: text("relevance_statement"),
  schemaVersion: text("schema_version").notNull(),
  generationEpoch: integer("generation_epoch").notNull().default(0),
  ...timestamps,
}, (table) => [
  uniqueIndex("preview_casting_unique").on(table.castingId),
  check("preview_epoch_nonnegative", sql`${table.generationEpoch} >= 0`),
]);

export const readings = pgTable("readings", {
  id: text("id").primaryKey(),
  castingId: text("casting_id").notNull().references(() => castingSessions.id, { onDelete: "cascade" }),
  status: readingStatus("status").notNull().default("not_started"),
  activeReservationId: text("active_reservation_id"),
  report: jsonb("report").$type<Record<string, unknown>>(),
  schemaVersion: text("schema_version").notNull(),
  generationEpoch: integer("generation_epoch").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("reading_casting_unique").on(table.castingId),
  check("reading_epoch_nonnegative", sql`${table.generationEpoch} >= 0`),
]);

export const generationJobs = pgTable("generation_jobs", {
  id: text("id").primaryKey(),
  target: jobTarget("target").notNull(),
  targetId: text("target_id").notNull(),
  castingId: text("casting_id").notNull().references(() => castingSessions.id, { onDelete: "cascade" }),
  status: jobStatus("status").notNull().default("queued"),
  generationEpoch: integer("generation_epoch").notNull(),
  snapshotHash: text("snapshot_hash").notNull(),
  snapshotCiphertext: text("snapshot_ciphertext").notNull(),
  snapshotIv: text("snapshot_iv").notNull(),
  snapshotAuthTag: text("snapshot_auth_tag").notNull(),
  snapshotKeyVersion: text("snapshot_key_version").notNull(),
  reservationId: text("reservation_id"),
  attemptCount: integer("attempt_count").notNull().default(0),
  timeoutAt: timestamp("timeout_at", { withTimezone: true }).notNull(),
  lastErrorCode: text("last_error_code"),
  ...timestamps,
}, (table) => [
  uniqueIndex("generation_active_snapshot_unique")
    .on(table.target, table.targetId, table.snapshotHash)
    .where(sql`${table.status} in ('queued','running','validating')`),
  index("generation_dispatch_idx").on(table.status, table.createdAt),
  check("generation_epoch_nonnegative", sql`${table.generationEpoch} >= 0`),
  check("generation_attempt_nonnegative", sql`${table.attemptCount} >= 0`),
]);

export const generationAttempts = pgTable("generation_attempts", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull().references(() => generationJobs.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").notNull(),
  providerRequestId: text("provider_request_id"),
  status: text("status").notNull(),
  errorCode: text("error_code"),
  tokenInput: integer("token_input"),
  tokenOutput: integer("token_output"),
  costMicros: bigint("cost_micros", { mode: "number" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("generation_attempt_number_unique").on(table.jobId, table.attemptNumber),
]);

export const dispatchOutbox = pgTable("dispatch_outbox", {
  id: text("id").primaryKey(),
  topic: text("topic").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  payload: jsonb("payload").notNull(),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  lastErrorCode: text("last_error_code"),
  ...timestamps,
}, (table) => [
  uniqueIndex("outbox_topic_aggregate_unique").on(table.topic, table.aggregateId),
  index("outbox_pending_idx").on(table.availableAt).where(sql`${table.dispatchedAt} is null`),
  check("outbox_attempt_nonnegative", sql`${table.attempts} >= 0`),
]);

export const webhookInbox = pgTable("webhook_inbox", {
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  signatureVersion: text("signature_version"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  processingErrorCode: text("processing_error_code"),
}, (table) => [
  primaryKey({ name: "webhook_inbox_pk", columns: [table.provider, table.eventId] }),
  uniqueIndex("webhook_provider_event_unique").on(table.provider, table.eventId),
  index("webhook_unprocessed_idx").on(table.receivedAt).where(sql`${table.processedAt} is null`),
]);

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  productId: text("product_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull(),
  requestId: text("request_id").notNull(),
  providerCheckoutId: text("provider_checkout_id"),
  providerCustomerId: text("provider_customer_id"),
  status: orderStatus("status").notNull().default("pending"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  disputedAt: timestamp("disputed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("order_request_unique").on(table.userId, table.requestId),
  uniqueIndex("order_provider_checkout_unique").on(table.providerCheckoutId).where(sql`${table.providerCheckoutId} is not null`),
  index("order_user_created_idx").on(table.userId, table.createdAt),
  check("order_amount_nonnegative", sql`${table.amountCents} >= 0`),
]);

export const entitlementBatches = pgTable("entitlement_batches", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  sourceOrderId: text("source_order_id").references(() => orders.id, { onDelete: "restrict" }),
  productId: text("product_id").notNull(),
  quantityTotal: integer("quantity_total").notNull(),
  quantityAvailable: integer("quantity_available").notNull(),
  quantityReserved: integer("quantity_reserved").notNull(),
  quantityConsumed: integer("quantity_consumed").notNull(),
  quantityRevoked: integer("quantity_revoked").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
}, (table) => [
  index("entitlement_user_expiry_idx").on(table.userId, table.expiresAt),
  check("entitlement_total_nonnegative", sql`${table.quantityTotal} >= 0`),
  check("entitlement_available_nonnegative", sql`${table.quantityAvailable} >= 0`),
  check("entitlement_reserved_nonnegative", sql`${table.quantityReserved} >= 0`),
  check("entitlement_consumed_nonnegative", sql`${table.quantityConsumed} >= 0`),
  check("entitlement_revoked_nonnegative", sql`${table.quantityRevoked} >= 0`),
  check(
    "entitlement_batch_identity",
    sql`${table.quantityAvailable} + ${table.quantityReserved} + ${table.quantityConsumed} + ${table.quantityRevoked} = ${table.quantityTotal}`,
  ),
]);

export const entitlementLedger = pgTable("entitlement_ledger", {
  id: text("id").primaryKey(),
  batchId: text("batch_id").notNull().references(() => entitlementBatches.id, { onDelete: "restrict" }),
  action: ledgerAction("action").notNull(),
  quantity: integer("quantity").notNull(),
  eventKey: text("event_key").notNull(),
  referenceType: text("reference_type").notNull(),
  referenceId: text("reference_id").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("entitlement_ledger_event_unique").on(table.eventKey),
  index("entitlement_ledger_batch_idx").on(table.batchId, table.createdAt),
  check("entitlement_ledger_quantity_positive", sql`${table.quantity} > 0`),
]);

export const reservations = pgTable("reservations", {
  id: text("id").primaryKey(),
  readingId: text("reading_id").notNull().references(() => readings.id, { onDelete: "restrict" }),
  batchId: text("batch_id").notNull().references(() => entitlementBatches.id, { onDelete: "restrict" }),
  status: reservationStatus("status").notNull().default("reserved"),
  terminalEventId: text("terminal_event_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  terminalAt: timestamp("terminal_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("reservation_reading_active_unique")
    .on(table.readingId)
    .where(sql`${table.status} = 'reserved'`),
  uniqueIndex("reservation_terminal_event_unique")
    .on(table.terminalEventId)
    .where(sql`${table.terminalEventId} is not null`),
  index("reservation_expiry_idx").on(table.expiresAt).where(sql`${table.status} = 'reserved'`),
]);

export const qualityReviews = pgTable("quality_reviews", {
  id: text("id").primaryKey(),
  readingId: text("reading_id").notNull().references(() => readings.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  status: qualityReviewStatus("status").notNull().default("submitted"),
  reason: text("reason").notNull(),
  responseDueAt: timestamp("response_due_at", { withTimezone: true }).notNull(),
  supplementedAt: timestamp("supplemented_at", { withTimezone: true }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  compensationBatchId: text("compensation_batch_id").references(() => entitlementBatches.id, { onDelete: "restrict" }),
  ...timestamps,
}, (table) => [
  uniqueIndex("quality_review_reading_unique").on(table.readingId),
  index("quality_review_due_idx").on(table.responseDueAt).where(sql`${table.status} in ('submitted','supplementing','in_review')`),
]);

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  safeContext: jsonb("safe_context").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("audit_aggregate_idx").on(table.aggregateType, table.aggregateId, table.createdAt),
]);
