import { bigint, boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { loginIntents, users } from "./auth-schema";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const castingLifecycle = pgEnum("casting_lifecycle", ["draft", "casting", "awaiting_reveal", "revealed", "expired", "discarded_duplicate", "emergency_blocked", "user_deleted"]);
export const jobStatus = pgEnum("job_status", ["queued", "running", "completed", "failed", "timed_out"]);
export const orderStatus = pgEnum("order_status", ["pending", "paid", "refunded", "disputed"]);

export { loginIntents, users } from "./auth-schema";
export const castingSessions = pgTable("casting_sessions", {
  id: uuid("id").defaultRandom().primaryKey(), userId: text("user_id").references(() => users.id), anonymousHash: text("anonymous_hash"), method: text("method").notNull(), lifecycle: castingLifecycle("lifecycle").notNull().default("draft"), riskStatus: text("risk_status").notNull().default("not_checked"), scene: text("scene").notNull(), interpretationGoal: text("interpretation_goal").notNull(), questionFingerprint: text("question_fingerprint"), firstIrreversibleStepAt: timestamp("first_irreversible_step_at", { withTimezone: true }), castingExpiresAt: timestamp("casting_expires_at", { withTimezone: true }), revealExpiresAt: timestamp("reveal_expires_at", { withTimezone: true }), deletedAt: timestamp("deleted_at", { withTimezone: true }), ...timestamps,
}, (t) => [index("casts_user_idx").on(t.userId), uniqueIndex("active_anonymous_cast_idx").on(t.anonymousHash).where(sql`lifecycle in ('draft','casting','awaiting_reveal')`)]);
export const questionVersions = pgTable("question_versions", { id: uuid("id").defaultRandom().primaryKey(), castingId: uuid("casting_id").notNull().references(() => castingSessions.id), ciphertext: text("ciphertext").notNull(), iv: text("iv").notNull(), authTag: text("auth_tag").notNull(), ...timestamps });
export const castingSteps = pgTable("casting_steps", { id: uuid("id").defaultRandom().primaryKey(), castingId: uuid("casting_id").notNull().references(() => castingSessions.id), stepKind: text("step_kind").notNull(), lineIndex: integer("line_index").notNull(), changeIndex: integer("change_index"), rawRecord: jsonb("raw_record").notNull(), lineValue: integer("line_value"), ...timestamps }, (t) => [uniqueIndex("casting_step_once_idx").on(t.castingId, t.stepKind, t.lineIndex, t.changeIndex)]);
export const castResults = pgTable("cast_results", { castingId: uuid("casting_id").primaryKey().references(() => castingSessions.id), lineValues: jsonb("line_values").notNull(), resultHmac: text("result_hmac").notNull(), ...timestamps });
export const generationJobs = pgTable("generation_jobs", { id: uuid("id").defaultRandom().primaryKey(), castingId: uuid("casting_id").notNull().references(() => castingSessions.id), type: text("type").notNull(), status: jobStatus("status").notNull().default("queued"), generationEpoch: integer("generation_epoch").notNull().default(0), snapshot: jsonb("snapshot").notNull(), timeoutAt: timestamp("timeout_at", { withTimezone: true }).notNull(), ...timestamps });
export const outbox = pgTable("outbox", { id: uuid("id").defaultRandom().primaryKey(), topic: text("topic").notNull(), payload: jsonb("payload").notNull(), dispatchedAt: timestamp("dispatched_at", { withTimezone: true }), attempts: integer("attempts").notNull().default(0), ...timestamps });
export const webhookInbox = pgTable("webhook_inbox", { provider: text("provider").notNull(), eventId: text("event_id").notNull(), payload: jsonb("payload").notNull(), processedAt: timestamp("processed_at", { withTimezone: true }), ...timestamps }, (t) => [uniqueIndex("webhook_event_once_idx").on(t.provider, t.eventId)]);
export const orders = pgTable("orders", { id: uuid("id").defaultRandom().primaryKey(), userId: text("user_id").notNull().references(() => users.id), providerCheckoutId: text("provider_checkout_id").unique(), status: orderStatus("status").notNull().default("pending"), amountCents: integer("amount_cents").notNull(), ...timestamps });
export const entitlementBatches = pgTable("entitlement_batches", { id: uuid("id").defaultRandom().primaryKey(), userId: text("user_id").notNull().references(() => users.id), total: integer("total").notNull(), available: integer("available").notNull(), reserved: integer("reserved").notNull(), consumed: integer("consumed").notNull(), revoked: integer("revoked").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), ...timestamps });
export const entitlementLedger = pgTable("entitlement_ledger", { id: uuid("id").defaultRandom().primaryKey(), batchId: uuid("batch_id").notNull().references(() => entitlementBatches.id), action: text("action").notNull(), quantity: integer("quantity").notNull(), ...timestamps });
