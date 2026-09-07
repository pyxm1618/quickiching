import { randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import { applyRefundSettlement } from "@/server/refunds/refund-settlement-core";
import { canonicalWaffoPayloadHash, type NormalizedWaffoWebhook } from "./waffo-webhook";
import { PostgresPaymentRepository } from "./postgres-repository";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;
type PaymentProcessOutcome = Awaited<ReturnType<PostgresPaymentRepository["processInbox"]>>;

type RefundLease = {
  terminal?: PaymentProcessOutcome;
  leaseToken?: string;
  event?: NormalizedWaffoWebhook;
};

function date(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function displayAmountMinor(value: string): number | null {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const amount = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : null;
}

function zeroTax(value: string): boolean {
  return /^0(?:\.0{1,2})?$/.test(value);
}

function refundEventFromPayload(value: unknown): NormalizedWaffoWebhook | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Partial<NormalizedWaffoWebhook>;
  if (
    event.provider !== "waffo"
    || (event.providerEnvironment !== "test" && event.providerEnvironment !== "prod")
    || (event.eventType !== "refund.succeeded" && event.eventType !== "refund.failed")
    || typeof event.eventId !== "string"
    || typeof event.providerOrderId !== "string"
    || (event.providerPaymentId !== null && typeof event.providerPaymentId !== "string")
    || typeof event.currency !== "string"
    || !Number.isSafeInteger(event.amountMinor)
    || typeof event.taxAmount !== "string"
    || (event.total !== null && typeof event.total !== "string")
    || (event.refundTicketMerchantExternalId !== null && typeof event.refundTicketMerchantExternalId !== "string")
  ) return null;
  return event as NormalizedWaffoWebhook;
}

async function linkedOrderId(
  transaction: TransactionSql,
  event: NormalizedWaffoWebhook,
): Promise<string | null> {
  for (const candidate of [event.orderMerchantExternalId, event.internalOrderId]) {
    if (!candidate || !UUID_PATTERN.test(candidate)) continue;
    const rows = await transaction`
      select id from payment_orders where id = ${candidate} limit 1
    ` as Row[];
    if (rows[0]) return String(rows[0].id);
  }
  return null;
}

export class CloseoutPaymentRepository extends PostgresPaymentRepository {
  constructor(
    private readonly closeoutSql: Sql,
    options: ConstructorParameters<typeof PostgresPaymentRepository>[1] = {},
  ) {
    super(closeoutSql, options);
  }

  private async persistBusinessConflict(
    transaction: TransactionSql,
    event: NormalizedWaffoWebhook,
    existing: Row,
    incomingOrderId: string | null,
  ): Promise<void> {
    const existingOrderId = existing.linked_order_id == null ? null : String(existing.linked_order_id);
    await transaction`
      insert into payment_webhook_conflicts (
        id, provider, provider_environment, conflict_type, reason_code,
        existing_inbox_id, existing_order_id, incoming_order_id,
        existing_payload_sha256, incoming_payload_sha256,
        existing_canonical_payload_sha256, incoming_canonical_payload_sha256,
        safe_existing_payload, safe_incoming_payload, created_at
      ) values (
        ${randomUUID()}, 'waffo', ${event.providerEnvironment}, 'business',
        'WEBHOOK_BUSINESS_EVENT_CONFLICT', ${String(existing.id)},
        ${existingOrderId}, ${incomingOrderId},
        ${existing.payload_sha256 == null ? null : String(existing.payload_sha256)},
        ${event.payloadSha256},
        ${existing.canonical_payload_sha256 == null ? null : String(existing.canonical_payload_sha256)},
        ${event.canonicalPayloadSha256},
        ${JSON.stringify(existing.normalized_payload ?? null)}::jsonb,
        ${JSON.stringify(event)}::jsonb, clock_timestamp()
      )
    `;
    await transaction`
      insert into payment_financial_reviews (
        id, order_id, inbox_id, reason_code, status, created_at, updated_at
      ) values (
        ${randomUUID()}, ${existingOrderId ?? incomingOrderId}, ${String(existing.id)},
        'WEBHOOK_BUSINESS_EVENT_CONFLICT', 'open', clock_timestamp(), clock_timestamp()
      ) on conflict (inbox_id) do nothing
    `;
    const orderId = existingOrderId ?? incomingOrderId;
    if (orderId) {
      await transaction`
        update payment_orders
        set status = case when status = 'refunded' then status else 'financial_review' end,
            updated_at = clock_timestamp()
        where id = ${orderId}
      `;
    }
    await transaction`
      insert into audit_events (
        id, category, action, entity_type, entity_id, payload, created_at
      ) values (
        ${randomUUID()}, 'webhook', 'provider_event_identity_conflict', 'webhook_event',
        ${event.eventId}, ${JSON.stringify({
          environment: event.providerEnvironment,
          eventId: event.eventId,
          existingEventType: String(existing.event_type),
          incomingEventType: event.eventType,
        })}::jsonb, clock_timestamp()
      )
    `;
  }

  override async recordVerifiedEvent(event: NormalizedWaffoWebhook): Promise<{
    inboxId: string;
    duplicate: "delivery" | "event" | null;
  }> {
    event = { ...event, canonicalPayloadSha256: canonicalWaffoPayloadHash(event) };
    const result = await this.closeoutSql.begin(async (transaction) => {
      const orderId = await linkedOrderId(transaction, event);
      const inboxId = randomUUID();
      const initialStatus = event.supported ? "received" : "ignored";
      const inserted = await transaction`
        insert into payment_webhook_inbox (
          id, provider, provider_environment, delivery_id, event_id, event_type,
          store_id, order_merchant_external_id, linked_order_id, payload_sha256,
          canonical_payload_sha256, normalized_payload, signature_verified_at, status,
          processed_at, created_at, updated_at
        ) values (
          ${inboxId}, 'waffo', ${event.providerEnvironment}, ${event.deliveryId},
          ${event.eventId}, ${event.eventType}, ${event.storeId},
          ${event.orderMerchantExternalId}, ${orderId}, ${event.payloadSha256},
          ${event.canonicalPayloadSha256}, ${JSON.stringify(event)}::jsonb,
          clock_timestamp(), ${initialStatus},
          case when ${event.supported} then null else clock_timestamp() end,
          clock_timestamp(), clock_timestamp()
        ) on conflict do nothing returning id
      ` as Row[];

      if (!inserted[0]) {
        const existingRows = await transaction`
          select id, event_type, linked_order_id, payload_sha256,
            canonical_payload_sha256, normalized_payload
          from payment_webhook_inbox
          where provider = 'waffo'
            and provider_environment = ${event.providerEnvironment}
            and event_id = ${event.eventId}
          limit 1 for update
        ` as Row[];
        const existing = existingRows[0];
        if (!existing) throw new Error("WEBHOOK_INBOX_UNAVAILABLE");
        const sameCanonical = String(existing.canonical_payload_sha256 ?? "") === event.canonicalPayloadSha256;
        const sameType = String(existing.event_type) === event.eventType;
        if (!sameCanonical || !sameType) {
          await this.persistBusinessConflict(transaction, event, existing, orderId);
          return { conflictCode: "WEBHOOK_BUSINESS_EVENT_CONFLICT" as const };
        }
        return { inboxId: String(existing.id), duplicate: "event" as const };
      }

      if (event.supported) {
        const topic = event.manualReviewReason
          ? "financial_review"
          : event.eventType === "order.completed" ? "grant_entitlement" : "revoke_entitlement";
        await transaction`
          insert into payment_outbox (
            id, inbox_id, order_id, topic, status, available_at, created_at, updated_at
          ) values (
            ${randomUUID()}, ${inboxId}, ${orderId}, ${topic}, 'pending',
            clock_timestamp(), clock_timestamp(), clock_timestamp()
          )
        `;
      }
      return { inboxId, duplicate: null };
    });
    if ("conflictCode" in result) throw new Error(result.conflictCode);
    return result;
  }

  private async acquireRefundLease(inboxId: string, callerLeaseToken?: string): Promise<RefundLease> {
    return this.closeoutSql.begin(async (transaction) => {
      const inboxRows = await transaction`
        select * from payment_webhook_inbox where id = ${inboxId} limit 1 for update
      ` as Row[];
      const inbox = inboxRows[0];
      if (!inbox) throw new Error("WEBHOOK_INBOX_UNAVAILABLE");
      const event = refundEventFromPayload(inbox.normalized_payload);
      if (!event) throw new Error("WEBHOOK_NORMALIZED_PAYLOAD_INVALID");
      const outboxRows = await transaction`
        select * from payment_outbox where inbox_id = ${inboxId} limit 1 for update
      ` as Row[];
      const outbox = outboxRows[0];
      if (!outbox) throw new Error("PAYMENT_OUTBOX_UNAVAILABLE");

      if (["processed", "financial_review"].includes(String(inbox.status)) && String(outbox.status) === "completed") {
        return { terminal: { outcome: "already_processed" } };
      }
      if (String(inbox.status) === "dead_letter" && String(outbox.status) === "dead_letter") {
        return { terminal: { outcome: "dead_letter" } };
      }
      if (["processed", "financial_review", "dead_letter"].includes(String(inbox.status))
        || ["completed", "dead_letter"].includes(String(outbox.status))) {
        throw new Error("PAYMENT_INBOX_OUTBOX_STATE_MISMATCH");
      }

      if (String(outbox.status) === "processing") {
        const leaseToken = outbox.lease_token == null ? null : String(outbox.lease_token);
        const leaseExpiresAt = outbox.lease_expires_at == null ? null : date(outbox.lease_expires_at);
        const active = leaseExpiresAt !== null && Number.isFinite(leaseExpiresAt.getTime()) && leaseExpiresAt.getTime() > Date.now();
        if (callerLeaseToken && callerLeaseToken === leaseToken && active) {
          return { leaseToken: callerLeaseToken, event };
        }
        if (active) return { terminal: { outcome: "processing" } };
      }

      const leaseToken = randomUUID();
      const attemptCount = Math.max(Number(inbox.attempt_count ?? 0), Number(outbox.attempt_count ?? 0)) + 1;
      await transaction`
        update payment_webhook_inbox
        set status = 'processing', attempt_count = ${attemptCount}, last_error_code = null,
            processed_at = null, updated_at = clock_timestamp()
        where id = ${inboxId}
      `;
      await transaction`
        update payment_outbox
        set status = 'processing', attempt_count = ${attemptCount}, lease_token = ${leaseToken},
            lease_expires_at = clock_timestamp() + interval '30 seconds', last_error_code = null,
            completed_at = null, updated_at = clock_timestamp()
        where id = ${String(outbox.id)}
      `;
      return { leaseToken, event };
    });
  }

  private async finalizeRefundWebhookReview(input: {
    inboxId: string;
    leaseToken: string;
    orderId: string | null;
    refundId: string | null;
    reason: string;
  }): Promise<PaymentProcessOutcome> {
    return this.closeoutSql.begin(async (transaction) => {
      if (input.orderId) {
        await transaction`select id from payment_orders where id = ${input.orderId} limit 1 for update`;
      }
      if (input.refundId) {
        await transaction`select id from refund_intents where id = ${input.refundId} limit 1 for update`;
      }
      await transaction`
        insert into payment_financial_reviews (
          id, order_id, inbox_id, reason_code, status, created_at, updated_at
        ) values (
          ${randomUUID()}, ${input.orderId}, ${input.inboxId}, ${input.reason}, 'open',
          clock_timestamp(), clock_timestamp()
        ) on conflict (inbox_id) do nothing
      `;
      if (input.orderId) {
        await transaction`
          update payment_orders
          set status = case when status = 'refunded' then status else 'financial_review' end,
              updated_at = clock_timestamp()
          where id = ${input.orderId}
        `;
      }
      if (input.refundId) {
        await transaction`
          update refund_intents
          set status = case when status = 'succeeded' then status else 'reconciliation_required' end,
              last_error_code = ${input.reason}, next_reconcile_at = null,
              reconcile_lease_token = null, reconcile_lease_expires_at = null,
              updated_at = clock_timestamp()
          where id = ${input.refundId}
        `;
      }
      await transaction`
        update payment_webhook_inbox
        set status = 'financial_review', last_error_code = ${input.reason},
            processed_at = clock_timestamp(), updated_at = clock_timestamp()
        where id = ${input.inboxId} and status = 'processing'
      `;
      const completed = await transaction`
        update payment_outbox
        set topic = 'financial_review', status = 'completed', last_error_code = ${input.reason},
            lease_token = null, lease_expires_at = null, completed_at = clock_timestamp(),
            updated_at = clock_timestamp()
        where inbox_id = ${input.inboxId} and status = 'processing' and lease_token = ${input.leaseToken}
        returning id
      ` as Row[];
      if (!completed[0]) throw new Error("PAYMENT_WEBHOOK_LEASE_LOST");
      await transaction`
        insert into audit_events (
          id, category, action, entity_type, entity_id, payload, created_at
        ) values (
          ${randomUUID()}, 'webhook', 'refund_webhook_financial_review', 'webhook_event',
          ${input.inboxId}, ${JSON.stringify({ orderId: input.orderId, refundId: input.refundId, reason: input.reason })}::jsonb,
          clock_timestamp()
        )
      `;
      return { outcome: "financial_review", reason: input.reason, ...(input.orderId ? { orderId: input.orderId } : {}) };
    });
  }

  private async completeRefundWebhook(
    inboxId: string,
    leaseToken: string,
    outcome: "revoked" | "ignored" | "already_processed",
    orderId: string,
  ): Promise<PaymentProcessOutcome> {
    return this.closeoutSql.begin(async (transaction) => {
      const outboxRows = await transaction`
        update payment_outbox
        set status = 'completed', lease_token = null, lease_expires_at = null,
            completed_at = clock_timestamp(), updated_at = clock_timestamp()
        where inbox_id = ${inboxId} and status = 'processing' and lease_token = ${leaseToken}
        returning id
      ` as Row[];
      if (!outboxRows[0]) throw new Error("PAYMENT_WEBHOOK_LEASE_LOST");
      const inboxRows = await transaction`
        update payment_webhook_inbox
        set status = 'processed', last_error_code = null,
            processed_at = clock_timestamp(), updated_at = clock_timestamp()
        where id = ${inboxId} and status = 'processing'
        returning id
      ` as Row[];
      if (!inboxRows[0]) throw new Error("PAYMENT_WEBHOOK_LEASE_LOST");
      return { outcome, orderId };
    });
  }

  private async processRefundInbox(
    inboxId: string,
    callerLeaseToken?: string,
  ): Promise<PaymentProcessOutcome> {
    const lease = await this.acquireRefundLease(inboxId, callerLeaseToken);
    if (lease.terminal) return lease.terminal;
    if (!lease.leaseToken || !lease.event) throw new Error("PAYMENT_OUTBOX_UNAVAILABLE");
    const { leaseToken, event } = lease;

    const correlation = event.refundTicketMerchantExternalId;
    if (!correlation || !UUID_PATTERN.test(correlation)) {
      const orderId = await linkedOrderIdFromSql(this.closeoutSql, event);
      return this.finalizeRefundWebhookReview({
        inboxId, leaseToken, orderId, refundId: null, reason: "REFUND_CORRELATION_MISSING",
      });
    }

    const identity = await this.closeoutSql.begin(async (transaction) => {
      const refundRows = await transaction`
        select * from refund_intents where id = ${correlation} limit 1
      ` as Row[];
      const refund = refundRows[0];
      if (!refund) return { reason: "REFUND_CORRELATION_UNKNOWN" as const, order: null, refund: null };
      const orderRows = await transaction`
        select * from payment_orders where id = ${String(refund.order_id)} limit 1
      ` as Row[];
      return { reason: null, order: orderRows[0] ?? null, refund };
    });
    const order = identity.order;
    const refund = identity.refund;
    if (!order || !refund) {
      const orderId = await linkedOrderIdFromSql(this.closeoutSql, event);
      return this.finalizeRefundWebhookReview({
        inboxId, leaseToken, orderId, refundId: null, reason: identity.reason ?? "REFUND_ORDER_NOT_FOUND",
      });
    }
    const orderId = String(order.id);
    let reason: string | null = null;
    if (String(refund.order_id) !== orderId) reason = "REFUND_ORDER_MISMATCH";
    else if (!event.merchantProvidedBuyerIdentity) reason = "PAYMENT_BUYER_IDENTITY_MISSING";
    else if (event.merchantProvidedBuyerIdentity !== String(order.user_id)) reason = "PAYMENT_BUYER_IDENTITY_MISMATCH";
    else if (!event.internalOrderId || !event.orderMerchantExternalId) reason = "PAYMENT_INTERNAL_ORDER_ID_MISSING";
    else if (event.internalOrderId !== orderId || event.orderMerchantExternalId !== orderId) reason = "PAYMENT_INTERNAL_ORDER_ID_MISMATCH";
    else if (event.providerEnvironment !== String(order.provider_environment)) reason = "PAYMENT_ENVIRONMENT_MISMATCH";
    else if (event.currency !== String(order.currency)) reason = "PAYMENT_CURRENCY_MISMATCH";
    else if (event.productKey !== String(order.product_key)) reason = "PAYMENT_PRODUCT_MISMATCH";
    else if (event.providerProductId !== String(order.provider_product_id)) reason = "PAYMENT_PROVIDER_PRODUCT_MISMATCH";
    else if (event.providerOrderId !== String(order.provider_order_id ?? "")) reason = "REFUND_PROVIDER_ID_MISMATCH";
    else if (event.providerPaymentId != null && event.providerPaymentId !== String(order.provider_payment_id ?? "")) reason = "REFUND_PROVIDER_ID_MISMATCH";
    else if (Number(order.amount_minor) !== event.amountMinor || Number(refund.requested_minor) !== event.amountMinor) reason = "REFUND_PARTIAL_UNSUPPORTED";
    else if (!zeroTax(event.taxAmount)) reason = "PAYMENT_TAX_SEMANTICS_UNRESOLVED";
    else if (event.total !== null && displayAmountMinor(event.total) !== event.amountMinor) reason = "PAYMENT_TOTAL_MISMATCH";
    if (reason) {
      return this.finalizeRefundWebhookReview({ inboxId, leaseToken, orderId, refundId: correlation, reason });
    }

    const localPaymentId = String(order.provider_payment_id ?? "");
    if (!localPaymentId) {
      return this.finalizeRefundWebhookReview({
        inboxId, leaseToken, orderId, refundId: correlation, reason: "REFUND_PAYMENT_IDENTITY_UNAVAILABLE",
      });
    }
    const result = await applyRefundSettlement(this.closeoutSql, {
      refundId: correlation,
      orderId,
      environment: event.providerEnvironment,
      providerOrderId: event.providerOrderId,
      providerPaymentId: event.providerPaymentId ?? localPaymentId,
      amountMinor: event.amountMinor,
      currency: "USD",
      providerTicketId: null,
      providerRefundId: null,
      status: event.eventType === "refund.succeeded" ? "succeeded" : "failed",
      source: "webhook",
      webhookInboxId: inboxId,
      now: new Date(),
    });
    if (result.outcome === "financial_review") {
      const rows = await this.closeoutSql`
        select last_error_code from refund_intents where id = ${correlation} limit 1
      ` as Row[];
      return this.finalizeRefundWebhookReview({
        inboxId,
        leaseToken,
        orderId,
        refundId: correlation,
        reason: rows[0]?.last_error_code == null ? "REFUND_SETTLEMENT_FINANCIAL_REVIEW" : String(rows[0].last_error_code),
      });
    }
    const mapped = result.outcome === "succeeded"
      ? "revoked"
      : result.outcome === "failed" ? "ignored" : "already_processed";
    return this.completeRefundWebhook(inboxId, leaseToken, mapped, orderId);
  }

  override async processInbox(
    inboxId: string,
    options: { leaseToken?: string } = {},
  ): Promise<PaymentProcessOutcome> {
    const rows = await this.closeoutSql`
      select event_type from payment_webhook_inbox where id = ${inboxId} limit 1
    ` as Row[];
    const eventType = rows[0]?.event_type == null ? null : String(rows[0].event_type);
    if (eventType === "refund.succeeded" || eventType === "refund.failed") {
      return this.processRefundInbox(inboxId, options.leaseToken);
    }
    return super.processInbox(inboxId, options);
  }
}

async function linkedOrderIdFromSql(sql: Sql, event: NormalizedWaffoWebhook): Promise<string | null> {
  for (const candidate of [event.orderMerchantExternalId, event.internalOrderId]) {
    if (!candidate || !UUID_PATTERN.test(candidate)) continue;
    const rows = await sql`select id from payment_orders where id = ${candidate} limit 1` as Row[];
    if (rows[0]) return String(rows[0].id);
  }
  return null;
}
