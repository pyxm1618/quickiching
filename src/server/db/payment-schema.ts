import { sql } from "drizzle-orm";
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
import { users } from "./auth-schema";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const paymentEnvironment = pgEnum("payment_environment", ["test", "prod"]);
export const paymentProductKey = pgEnum("payment_product_key", ["one", "three", "five"]);
export const paymentOrderStatus = pgEnum("payment_order_status", [
  "pending",
  "checkout_initializing",
  "checkout_created",
  "paid",
  "refunded",
  "financial_review",
]);
export const paymentInboxStatus = pgEnum("payment_inbox_status", [
  "received",
  "processing",
  "processed",
  "ignored",
  "pending_order",
  "financial_review",
  "failed",
  "dead_letter",
]);
export const paymentOutboxStatus = pgEnum("payment_outbox_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "dead_letter",
]);
export const paymentOutboxTopic = pgEnum("payment_outbox_topic", [
  "grant_entitlement",
  "revoke_entitlement",
  "financial_review",
]);
export const entitlementLedgerAction = pgEnum("entitlement_ledger_action", [
  "grant",
  "reserve",
  "consume",
  "release",
  "expire",
  "revoke",
  "compensate",
]);
export const financialReviewStatus = pgEnum("financial_review_status", ["open", "resolved"]);

export const paymentOrders = pgTable(
  "payment_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    productKey: paymentProductKey("product_key").notNull(),
    quantity: integer("quantity").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    requestId: text("request_id").notNull(),
    provider: text("provider").notNull().default("waffo"),
    providerEnvironment: paymentEnvironment("provider_environment").notNull(),
    providerProductId: text("provider_product_id").notNull(),
    providerCheckoutSessionId: text("provider_checkout_session_id"),
    providerCheckoutUrl: text("provider_checkout_url"),
    checkoutExpiresAt: timestamp("checkout_expires_at", { withTimezone: true }),
    checkoutClaimToken: text("checkout_claim_token"),
    checkoutClaimExpiresAt: timestamp("checkout_claim_expires_at", { withTimezone: true }),
    checkoutErrorCode: text("checkout_error_code"),
    providerOrderId: text("provider_order_id"),
    providerPaymentId: text("provider_payment_id"),
    status: paymentOrderStatus("status").notNull().default("pending"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payment_orders_user_request_idx").on(table.userId, table.requestId),
    uniqueIndex("payment_orders_checkout_session_idx").on(table.providerCheckoutSessionId),
    uniqueIndex("payment_orders_provider_order_idx").on(table.provider, table.providerEnvironment, table.providerOrderId),
    uniqueIndex("payment_orders_provider_payment_idx").on(table.provider, table.providerEnvironment, table.providerPaymentId),
    index("payment_orders_user_history_idx").on(table.userId, table.createdAt),
    check("payment_orders_currency_check", sql`${table.currency} = 'USD'`),
    check("payment_orders_provider_check", sql`${table.provider} = 'waffo'`),
    check("payment_orders_product_truth_check", sql`(
      (${table.productKey} = 'one' and ${table.quantity} = 1 and ${table.amountMinor} = 299)
      or (${table.productKey} = 'three' and ${table.quantity} = 3 and ${table.amountMinor} = 699)
      or (${table.productKey} = 'five' and ${table.quantity} = 5 and ${table.amountMinor} = 999)
    )`),
    check("payment_orders_checkout_shape_check", sql`(
      ${table.status} = 'pending'
      or (${table.status} = 'checkout_initializing' and ${table.checkoutClaimToken} is not null and ${table.checkoutClaimExpiresAt} is not null)
      or (${table.status} = 'checkout_created' and ${table.providerCheckoutSessionId} is not null and ${table.providerCheckoutUrl} is not null and ${table.checkoutExpiresAt} is not null)
      or (${table.status} = 'paid'
        and ${table.providerOrderId} is not null
        and ${table.providerPaymentId} is not null
        and ${table.paidAt} is not null
        and ${table.refundedAt} is null)
      or (${table.status} = 'refunded'
        and ${table.providerOrderId} is not null
        and ${table.providerPaymentId} is not null
        and ${table.paidAt} is not null
        and ${table.refundedAt} is not null)
      or ${table.status} = 'financial_review'
    )`),
  ],
);

export const paymentWebhookInbox = pgTable(
  "payment_webhook_inbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull().default("waffo"),
    providerEnvironment: paymentEnvironment("provider_environment").notNull(),
    deliveryId: text("delivery_id").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    storeId: text("store_id").notNull(),
    orderMerchantExternalId: text("order_merchant_external_id"),
    linkedOrderId: uuid("linked_order_id").references(() => paymentOrders.id, { onDelete: "restrict" }),
    payloadSha256: text("payload_sha256").notNull(),
    canonicalPayloadSha256: text("canonical_payload_sha256"),
    normalizedPayload: jsonb("normalized_payload").notNull(),
    signatureVerifiedAt: timestamp("signature_verified_at", { withTimezone: true }).notNull(),
    status: paymentInboxStatus("status").notNull().default("received"),
    attemptCount: integer("attempt_count").notNull().default(0),
    replayCount: integer("replay_count").notNull().default(0),
    lastReplayReason: text("last_replay_reason"),
    lastErrorCode: text("last_error_code"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payment_inbox_delivery_idx").on(table.provider, table.providerEnvironment, table.deliveryId),
    uniqueIndex("payment_inbox_business_event_idx").on(table.provider, table.providerEnvironment, table.eventType, table.eventId),
    index("payment_inbox_order_idx").on(table.orderMerchantExternalId, table.createdAt),
    index("payment_inbox_pending_refund_idx")
      .on(table.linkedOrderId, table.status, table.eventType, table.createdAt)
      .where(sql`${table.eventType} = 'refund.succeeded'`),
    index("payment_inbox_retry_idx").on(table.status, table.updatedAt),
    check("payment_inbox_provider_check", sql`${table.provider} = 'waffo'`),
    check("payment_inbox_attempt_count_check", sql`${table.attemptCount} >= 0`),
  ],
);

export const paymentOutbox = pgTable(
  "payment_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inboxId: uuid("inbox_id").notNull().references(() => paymentWebhookInbox.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").references(() => paymentOrders.id, { onDelete: "restrict" }),
    topic: paymentOutboxTopic("topic").notNull(),
    status: paymentOutboxStatus("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    leaseToken: text("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payment_outbox_inbox_idx").on(table.inboxId),
    index("payment_outbox_dispatch_idx").on(table.status, table.availableAt),
    check("payment_outbox_attempt_count_check", sql`${table.attemptCount} >= 0`),
  ],
);

export const entitlementBatches = pgTable(
  "entitlement_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").notNull().references(() => paymentOrders.id, { onDelete: "restrict" }),
    quantityTotal: integer("quantity_total").notNull(),
    quantityAvailable: integer("quantity_available").notNull(),
    quantityReserved: integer("quantity_reserved").notNull().default(0),
    quantityConsumed: integer("quantity_consumed").notNull().default(0),
    quantityRevoked: integer("quantity_revoked").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("entitlement_batches_order_idx").on(table.orderId),
    index("entitlement_batches_user_expiry_idx").on(table.userId, table.expiresAt),
    check("entitlement_batches_identity_check", sql`
      ${table.quantityTotal} > 0
      and ${table.quantityAvailable} >= 0
      and ${table.quantityReserved} >= 0
      and ${table.quantityConsumed} >= 0
      and ${table.quantityRevoked} >= 0
      and ${table.quantityAvailable} + ${table.quantityReserved} + ${table.quantityConsumed} + ${table.quantityRevoked} = ${table.quantityTotal}
    `),
  ],
);

export const entitlementLedger = pgTable(
  "entitlement_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id").notNull().references(() => entitlementBatches.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").notNull().references(() => paymentOrders.id, { onDelete: "restrict" }),
    webhookInboxId: uuid("webhook_inbox_id").references(() => paymentWebhookInbox.id, { onDelete: "restrict" }),
    action: entitlementLedgerAction("action").notNull(),
    quantity: integer("quantity").notNull(),
    businessKey: text("business_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("entitlement_ledger_business_key_idx").on(table.businessKey),
    uniqueIndex("entitlement_ledger_order_action_once_idx")
      .on(table.orderId, table.action)
      .where(sql`${table.action} in ('grant', 'revoke')`),
    index("entitlement_ledger_batch_history_idx").on(table.batchId, table.createdAt),
    check("entitlement_ledger_quantity_check", sql`${table.quantity} > 0`),
  ],
);

export const paymentFinancialReviews = pgTable(
  "payment_financial_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").references(() => paymentOrders.id, { onDelete: "restrict" }),
    inboxId: uuid("inbox_id").notNull().references(() => paymentWebhookInbox.id, { onDelete: "restrict" }),
    reasonCode: text("reason_code").notNull(),
    status: financialReviewStatus("status").notNull().default("open"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payment_financial_reviews_inbox_idx").on(table.inboxId),
    index("payment_financial_reviews_open_idx").on(table.status, table.createdAt),
  ],
);

export const paymentCheckoutBudgets = pgTable(
  "payment_checkout_budgets",
  {
    userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "restrict" }),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    check("payment_checkout_budgets_attempt_count_check", sql`${table.attemptCount} >= 0`),
  ],
);

export const paymentWebhookConflicts = pgTable(
  "payment_webhook_conflicts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull().default("waffo"),
    providerEnvironment: paymentEnvironment("provider_environment").notNull(),
    conflictType: text("conflict_type").notNull(),
    reasonCode: text("reason_code").notNull(),
    existingInboxId: uuid("existing_inbox_id").references(() => paymentWebhookInbox.id, { onDelete: "restrict" }),
    incomingInboxId: uuid("incoming_inbox_id").references(() => paymentWebhookInbox.id, { onDelete: "restrict" }),
    existingOrderId: uuid("existing_order_id").references(() => paymentOrders.id, { onDelete: "restrict" }),
    incomingOrderId: uuid("incoming_order_id").references(() => paymentOrders.id, { onDelete: "restrict" }),
    existingPayloadSha256: text("existing_payload_sha256"),
    incomingPayloadSha256: text("incoming_payload_sha256"),
    existingCanonicalPayloadSha256: text("existing_canonical_payload_sha256"),
    incomingCanonicalPayloadSha256: text("incoming_canonical_payload_sha256"),
    safeExistingPayload: jsonb("safe_existing_payload"),
    safeIncomingPayload: jsonb("safe_incoming_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payment_webhook_conflicts_order_idx").on(table.existingOrderId, table.createdAt),
    index("payment_webhook_conflicts_inbox_idx").on(table.existingInboxId, table.createdAt),
    check("payment_webhook_conflicts_provider_check", sql`${table.provider} = 'waffo'`),
  ],
);

export const paymentSchema = {
  paymentOrders,
  paymentWebhookInbox,
  paymentOutbox,
  entitlementBatches,
  entitlementLedger,
  paymentFinancialReviews,
  paymentCheckoutBudgets,
  paymentWebhookConflicts,
};
