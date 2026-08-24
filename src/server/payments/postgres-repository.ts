import { randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import type { CheckoutOrderRecord, CheckoutRepository } from "./checkout-service";
import type { NormalizedWaffoWebhook } from "./waffo-webhook";

type Row = Record<string, any>;
type CreateOrderInput = Parameters<CheckoutRepository["createOrGetOrder"]>[0];
type ProcessOutcome = {
  outcome: "granted" | "revoked" | "pending_order" | "financial_review" | "ignored" | "already_processed";
  reason?: string;
  orderId?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function date(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function orderFromRow(row: Row): CheckoutOrderRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    productKey: row.product_key,
    quantity: Number(row.quantity),
    amountMinor: Number(row.amount_minor),
    currency: row.currency,
    requestId: String(row.request_id),
    providerEnvironment: row.provider_environment,
    providerProductId: String(row.provider_product_id),
    providerCheckoutSessionId: row.provider_checkout_session_id == null ? null : String(row.provider_checkout_session_id),
    providerCheckoutUrl: row.provider_checkout_url == null ? null : String(row.provider_checkout_url),
    checkoutExpiresAt: row.checkout_expires_at == null ? null : date(row.checkout_expires_at),
    status: row.status,
  };
}

function sameOrderIdentity(row: Row, input: CreateOrderInput): boolean {
  return String(row.user_id) === input.userId
    && row.product_key === input.productKey
    && Number(row.quantity) === input.quantity
    && Number(row.amount_minor) === input.amountMinor
    && row.currency === input.currency
    && String(row.request_id) === input.requestId
    && row.provider_environment === input.providerEnvironment
    && String(row.provider_product_id) === input.providerProductId;
}

function normalizedEvent(value: unknown): NormalizedWaffoWebhook | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Partial<NormalizedWaffoWebhook>;
  if (
    event.provider !== "waffo"
    || (event.providerEnvironment !== "test" && event.providerEnvironment !== "prod")
    || typeof event.deliveryId !== "string"
    || typeof event.eventId !== "string"
    || typeof event.eventType !== "string"
    || typeof event.storeId !== "string"
    || typeof event.providerOrderId !== "string"
    || typeof event.currency !== "string"
    || !Number.isSafeInteger(event.amountMinor)
    || typeof event.taxAmount !== "string"
    || typeof event.payloadSha256 !== "string"
    || typeof event.supported !== "boolean"
    || (event.manualReviewReason !== null && event.manualReviewReason !== "CHARGEBACK_POLICY_UNRESOLVED")
  ) return null;
  return event as NormalizedWaffoWebhook;
}

function safeFailureCode(value: string): string {
  const candidate = value.trim();
  return /^[A-Z][A-Z0-9_]{0,63}$/.test(candidate) ? candidate : "PAYMENT_PROCESSING_FAILURE";
}

function zeroTax(value: string): boolean {
  return /^0(?:\.0{1,2})?$/.test(value);
}

function displayAmountMinor(value: string): number | null {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const amount = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : null;
}

export class PostgresPaymentRepository implements CheckoutRepository {
  constructor(private readonly sql: Sql) {}

  async createOrGetOrder(input: CreateOrderInput): Promise<{ order: CheckoutOrderRecord; created: boolean }> {
    return this.sql.begin(async (transaction) => {
      const inserted = await transaction`
        insert into payment_orders (
          id, user_id, product_key, quantity, amount_minor, currency, request_id,
          provider, provider_environment, provider_product_id, status,
          created_at, updated_at
        ) values (
          ${randomUUID()}, ${input.userId}, ${input.productKey}, ${input.quantity},
          ${input.amountMinor}, ${input.currency}, ${input.requestId}, 'waffo',
          ${input.providerEnvironment}, ${input.providerProductId}, 'pending',
          clock_timestamp(), clock_timestamp()
        ) on conflict do nothing returning *
      ` as Row[];
      if (inserted[0]) return { order: orderFromRow(inserted[0]), created: true };

      const existing = await transaction`
        select * from payment_orders
        where user_id = ${input.userId} and request_id = ${input.requestId}
        limit 1
        for update
      ` as Row[];
      if (!existing[0] || !sameOrderIdentity(existing[0], input)) {
        throw new Error("PAYMENT_IDEMPOTENCY_CONFLICT");
      }
      return { order: orderFromRow(existing[0]), created: false };
    });
  }

  async claimCheckoutInitialization(input: {
    orderId: string;
    claimToken: string;
    leaseDurationMs: number;
  }): Promise<boolean> {
    if (
      !UUID_PATTERN.test(input.orderId)
      || !input.claimToken.trim()
      || input.claimToken.length > 128
      || !Number.isSafeInteger(input.leaseDurationMs)
      || input.leaseDurationMs < 1_000
      || input.leaseDurationMs > 5 * 60 * 1000
    ) return false;
    const rows = await this.sql`
      update payment_orders
      set status = 'checkout_initializing', checkout_claim_token = ${input.claimToken},
          checkout_claim_expires_at = clock_timestamp() + (${input.leaseDurationMs} * interval '1 millisecond'),
          checkout_error_code = null, updated_at = clock_timestamp()
      where id = ${input.orderId} and status = 'pending'
        and checkout_claim_token is null and checkout_claim_expires_at is null
      returning id
    ` as Row[];
    return rows.length === 1;
  }

  async saveCheckout(input: Parameters<CheckoutRepository["saveCheckout"]>[0]): Promise<CheckoutOrderRecord> {
    const rows = await this.sql`
      update payment_orders
      set provider_checkout_session_id = ${input.providerCheckoutSessionId},
          provider_checkout_url = ${input.providerCheckoutUrl},
          checkout_expires_at = ${input.checkoutExpiresAt.toISOString()}::timestamptz,
          checkout_claim_token = null, checkout_claim_expires_at = null,
          checkout_error_code = null, status = 'checkout_created', updated_at = clock_timestamp()
      where id = ${input.orderId} and status = 'checkout_initializing'
        and checkout_claim_token = ${input.claimToken}
      returning *
    ` as Row[];
    if (!rows[0]) throw new Error("PAYMENT_CHECKOUT_CLAIM_INVALID");
    return orderFromRow(rows[0]);
  }

  async failCheckoutInitialization(input: {
    orderId: string;
    claimToken: string;
    errorCode: string;
  }): Promise<void> {
    const code = safeFailureCode(input.errorCode);
    const rows = await this.sql`
      update payment_orders
      set status = 'financial_review', checkout_claim_token = null,
          checkout_claim_expires_at = null, checkout_error_code = ${code},
          updated_at = clock_timestamp()
      where id = ${input.orderId} and status = 'checkout_initializing'
        and checkout_claim_token = ${input.claimToken}
      returning id
    ` as Row[];
    if (!rows[0]) throw new Error("PAYMENT_CHECKOUT_CLAIM_INVALID");
  }

  async recordVerifiedEvent(event: NormalizedWaffoWebhook): Promise<{
    inboxId: string;
    duplicate: "delivery" | "event" | null;
  }> {
    return this.sql.begin(async (transaction) => {
      let linkedOrderId: string | null = null;
      if (event.orderMerchantExternalId && UUID_PATTERN.test(event.orderMerchantExternalId)) {
        const linked = await transaction`
          select id from payment_orders where id = ${event.orderMerchantExternalId} limit 1
        ` as Row[];
        linkedOrderId = linked[0] ? String(linked[0].id) : null;
      }
      const inboxId = randomUUID();
      const initialStatus = event.supported ? "received" : "ignored";
      const inserted = await transaction`
        insert into payment_webhook_inbox (
          id, provider, provider_environment, delivery_id, event_id, event_type,
          store_id, order_merchant_external_id, linked_order_id, payload_sha256,
          normalized_payload, signature_verified_at, status, processed_at,
          created_at, updated_at
        ) values (
          ${inboxId}, 'waffo', ${event.providerEnvironment}, ${event.deliveryId},
          ${event.eventId}, ${event.eventType}, ${event.storeId},
          ${event.orderMerchantExternalId}, ${linkedOrderId}, ${event.payloadSha256},
          ${JSON.stringify(event)}::jsonb, clock_timestamp(), ${initialStatus},
          case when ${event.supported} then null else clock_timestamp() end,
          clock_timestamp(), clock_timestamp()
        ) on conflict do nothing returning id
      ` as Row[];
      if (!inserted[0]) {
        const delivery = await transaction`
          select id, payload_sha256 from payment_webhook_inbox
          where provider = 'waffo' and provider_environment = ${event.providerEnvironment}
            and delivery_id = ${event.deliveryId}
          limit 1
        ` as Row[];
        if (delivery[0]) {
          if (String(delivery[0].payload_sha256) !== event.payloadSha256) {
            throw new Error("WEBHOOK_DELIVERY_CONFLICT");
          }
          return { inboxId: String(delivery[0].id), duplicate: "delivery" as const };
        }
        const business = await transaction`
          select id from payment_webhook_inbox
          where provider = 'waffo' and provider_environment = ${event.providerEnvironment}
            and event_type = ${event.eventType} and event_id = ${event.eventId}
          limit 1
        ` as Row[];
        if (!business[0]) throw new Error("WEBHOOK_INBOX_UNAVAILABLE");
        return { inboxId: String(business[0].id), duplicate: "event" as const };
      }

      if (event.supported) {
        const topic = event.manualReviewReason
          ? "financial_review"
          : event.eventType === "order.completed" ? "grant_entitlement" : "revoke_entitlement";
        await transaction`
          insert into payment_outbox (
            id, inbox_id, order_id, topic, status, available_at, created_at, updated_at
          ) values (
            ${randomUUID()}, ${inboxId}, ${linkedOrderId}, ${topic}, 'pending',
            clock_timestamp(), clock_timestamp(), clock_timestamp()
          )
        `;
      }
      return { inboxId, duplicate: null };
    });
  }

  async processInbox(inboxId: string): Promise<ProcessOutcome> {
    const outcome = await this.sql.begin((transaction) => this.processInboxTransaction(transaction, inboxId));
    if (outcome.outcome === "granted" && outcome.orderId) {
      await this.processPendingRefunds(outcome.orderId);
    }
    return outcome;
  }

  private async processPendingRefunds(orderId: string): Promise<void> {
    const rows = await this.sql`
      select id from payment_webhook_inbox
      where linked_order_id = ${orderId} and event_type = 'refund.succeeded'
        and status = 'pending_order'
      order by created_at asc, id asc
    ` as Row[];
    for (const row of rows) {
      try {
        await this.sql.begin((transaction) => this.processInboxTransaction(transaction, String(row.id)));
      } catch {
        // The verified Inbox/Outbox row remains retryable. Do not roll back an
        // already-committed grant or convert it into a second provider event.
        try {
          await this.recordProcessingFailure(String(row.id), "PAYMENT_PROCESSING_FAILURE");
        } catch {
          // A later signed retry can still re-enter the retained Inbox row.
        }
      }
    }
  }

  private async processInboxTransaction(transaction: TransactionSql, inboxId: string): Promise<ProcessOutcome> {
    const inboxRows = await transaction`
      select * from payment_webhook_inbox where id = ${inboxId} limit 1 for update
    ` as Row[];
    const inbox = inboxRows[0];
    if (!inbox) throw new Error("WEBHOOK_INBOX_UNAVAILABLE");
    if (inbox.status === "ignored") return { outcome: "ignored" };
    if (["processed", "financial_review", "dead_letter"].includes(String(inbox.status))) {
      return { outcome: "already_processed" };
    }

    const outboxRows = await transaction`
      select * from payment_outbox where inbox_id = ${inboxId} limit 1 for update
    ` as Row[];
    const outbox = outboxRows[0];
    if (!outbox) throw new Error("PAYMENT_OUTBOX_UNAVAILABLE");
    if (["completed", "dead_letter"].includes(String(outbox.status))) {
      return { outcome: "already_processed" };
    }
    await transaction`
      update payment_outbox
      set status = 'processing', attempt_count = attempt_count + 1,
          last_error_code = null, updated_at = clock_timestamp()
      where id = ${String(outbox.id)}
    `;

    const event = normalizedEvent(inbox.normalized_payload);
    if (!event) {
      return this.financialReview(transaction, inbox, outbox, null, "WEBHOOK_NORMALIZED_PAYLOAD_INVALID");
    }

    const externalOrderId = inbox.order_merchant_external_id == null ? null : String(inbox.order_merchant_external_id);
    const orderRows = externalOrderId && UUID_PATTERN.test(externalOrderId)
      ? await transaction`select * from payment_orders where id = ${externalOrderId} limit 1 for update` as Row[]
      : [];
    const order = orderRows[0] ?? null;
    if (!order) {
      await transaction`
        update payment_webhook_inbox
        set status = 'pending_order', updated_at = clock_timestamp()
        where id = ${inboxId}
      `;
      await transaction`
        update payment_outbox
        set status = 'pending', order_id = null, updated_at = clock_timestamp()
        where id = ${String(outbox.id)}
      `;
      return { outcome: "pending_order" };
    }

    await transaction`
      update payment_webhook_inbox
      set linked_order_id = ${String(order.id)}, updated_at = clock_timestamp()
      where id = ${inboxId}
    `;
    await transaction`
      update payment_outbox
      set order_id = ${String(order.id)}, updated_at = clock_timestamp()
      where id = ${String(outbox.id)}
    `;

    const mismatch = this.orderMismatchReason(order, event);
    if (mismatch) return this.financialReview(transaction, inbox, outbox, order, mismatch);
    if (event.manualReviewReason) {
      return this.financialReview(transaction, inbox, outbox, order, event.manualReviewReason);
    }
    if (!zeroTax(event.taxAmount)) {
      return this.financialReview(transaction, inbox, outbox, order, "PAYMENT_TAX_SEMANTICS_UNRESOLVED");
    }
    if (event.eventType !== "refund.succeeded" && event.total !== null
      && displayAmountMinor(event.total) !== event.amountMinor) {
      return this.financialReview(transaction, inbox, outbox, order, "PAYMENT_TOTAL_MISMATCH");
    }
    if (String(order.status) === "financial_review") {
      return this.financialReview(transaction, inbox, outbox, order, "ORDER_FINANCIAL_REVIEW_REQUIRED");
    }

    if (event.eventType === "order.completed") {
      return this.grant(transaction, inbox, outbox, order, event);
    }
    if (event.eventType === "refund.succeeded") {
      return this.revoke(transaction, inbox, outbox, order, event);
    }
    await transaction`
      update payment_webhook_inbox
      set status = 'ignored', processed_at = clock_timestamp(), updated_at = clock_timestamp()
      where id = ${inboxId}
    `;
    await transaction`
      update payment_outbox
      set status = 'completed', completed_at = clock_timestamp(), updated_at = clock_timestamp()
      where id = ${String(outbox.id)}
    `;
    return { outcome: "ignored" };
  }

  private orderMismatchReason(order: Row, event: NormalizedWaffoWebhook): string | null {
    if (order.provider_environment !== event.providerEnvironment) return "PAYMENT_ENVIRONMENT_MISMATCH";
    if (order.currency !== event.currency) return "PAYMENT_CURRENCY_MISMATCH";
    if (order.product_key !== event.productKey) return "PAYMENT_PRODUCT_MISMATCH";
    if (String(order.provider_product_id) !== event.providerProductId) return "PAYMENT_PROVIDER_PRODUCT_MISMATCH";
    if (event.eventType !== "refund.succeeded" && Number(order.amount_minor) !== event.amountMinor) {
      return "PAYMENT_AMOUNT_MISMATCH";
    }
    return null;
  }

  private async grant(
    transaction: TransactionSql,
    inbox: Row,
    outbox: Row,
    order: Row,
    event: NormalizedWaffoWebhook,
  ): Promise<ProcessOutcome> {
    if (!event.providerPaymentId) {
      return this.financialReview(transaction, inbox, outbox, order, "PAYMENT_PROVIDER_ID_MISSING");
    }
    if (order.status === "refunded") return { outcome: "already_processed" };
    if (order.status === "paid") {
      if (
        String(order.provider_order_id) !== event.providerOrderId
        || String(order.provider_payment_id) !== event.providerPaymentId
      ) return this.financialReview(transaction, inbox, outbox, order, "PAYMENT_PROVIDER_ID_MISMATCH");
      await this.completeInbox(transaction, String(inbox.id), String(outbox.id));
      return { outcome: "already_processed" };
    }

    const providerConflicts = await transaction`
      select id from payment_orders
      where id <> ${String(order.id)} and provider = 'waffo'
        and provider_environment = ${event.providerEnvironment}
        and (provider_order_id = ${event.providerOrderId} or provider_payment_id = ${event.providerPaymentId})
      limit 1
    ` as Row[];
    if (providerConflicts[0]) {
      return this.financialReview(transaction, inbox, outbox, order, "PAYMENT_PROVIDER_ID_CONFLICT");
    }

    const batchRows = await transaction`
      insert into entitlement_batches (
        id, user_id, order_id, quantity_total, quantity_available,
        quantity_reserved, quantity_consumed, quantity_revoked, expires_at,
        created_at, updated_at
      ) values (
        ${randomUUID()}, ${String(order.user_id)}, ${String(order.id)}, ${Number(order.quantity)},
        ${Number(order.quantity)}, 0, 0, 0, clock_timestamp() + interval '12 months',
        clock_timestamp(), clock_timestamp()
      ) on conflict (order_id) do nothing returning id
    ` as Row[];
    const batch = batchRows[0] ?? (await transaction`
      select id from entitlement_batches where order_id = ${String(order.id)} limit 1 for update
    ` as Row[])[0];
    if (!batch) throw new Error("ENTITLEMENT_BATCH_UNAVAILABLE");
    await transaction`
      insert into entitlement_ledger (
        id, batch_id, order_id, webhook_inbox_id, action, quantity, business_key
      ) values (
        ${randomUUID()}, ${String(batch.id)}, ${String(order.id)}, ${String(inbox.id)},
        'grant', ${Number(order.quantity)}, ${`grant:${String(order.id)}`}
      ) on conflict (business_key) do nothing
    `;
    await transaction`
      update payment_orders
      set provider_order_id = ${event.providerOrderId}, provider_payment_id = ${event.providerPaymentId},
          status = 'paid', paid_at = clock_timestamp(), updated_at = clock_timestamp()
      where id = ${String(order.id)}
    `;
    await this.completeInbox(transaction, String(inbox.id), String(outbox.id));

    return { outcome: "granted", orderId: String(order.id) };
  }

  private async revoke(
    transaction: TransactionSql,
    inbox: Row,
    outbox: Row,
    order: Row,
    event: NormalizedWaffoWebhook,
  ): Promise<ProcessOutcome> {
    if (Number(order.amount_minor) !== event.amountMinor) {
      return this.financialReview(transaction, inbox, outbox, order, "REFUND_PARTIAL_UNSUPPORTED");
    }
    if (event.total !== null && displayAmountMinor(event.total) !== event.amountMinor) {
      return this.financialReview(transaction, inbox, outbox, order, "PAYMENT_TOTAL_MISMATCH");
    }
    if (order.status === "refunded") {
      await this.completeInbox(transaction, String(inbox.id), String(outbox.id));
      return { outcome: "already_processed" };
    }
    if (order.status !== "paid") {
      await transaction`
        update payment_webhook_inbox
        set status = 'pending_order', updated_at = clock_timestamp()
        where id = ${String(inbox.id)}
      `;
      await transaction`
        update payment_outbox
        set status = 'pending', updated_at = clock_timestamp()
        where id = ${String(outbox.id)}
      `;
      return { outcome: "pending_order" };
    }
    if (
      (order.provider_order_id != null && String(order.provider_order_id) !== event.providerOrderId)
      || (order.provider_payment_id != null && event.providerPaymentId != null
        && String(order.provider_payment_id) !== event.providerPaymentId)
    ) return this.financialReview(transaction, inbox, outbox, order, "REFUND_PROVIDER_ID_MISMATCH");

    const batches = await transaction`
      select * from entitlement_batches where order_id = ${String(order.id)} limit 1 for update
    ` as Row[];
    const batch = batches[0];
    if (!batch) throw new Error("ENTITLEMENT_BATCH_UNAVAILABLE");
    if (
      Number(batch.quantity_available) !== Number(batch.quantity_total)
      || Number(batch.quantity_reserved) !== 0
      || Number(batch.quantity_consumed) !== 0
      || Number(batch.quantity_revoked) !== 0
    ) {
      return this.financialReview(transaction, inbox, outbox, order, "REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE");
    }
    await transaction`
      update entitlement_batches
      set quantity_available = 0, quantity_revoked = quantity_total, updated_at = clock_timestamp()
      where id = ${String(batch.id)}
    `;
    await transaction`
      insert into entitlement_ledger (
        id, batch_id, order_id, webhook_inbox_id, action, quantity, business_key
      ) values (
        ${randomUUID()}, ${String(batch.id)}, ${String(order.id)}, ${String(inbox.id)},
        'revoke', ${Number(order.quantity)}, ${`revoke:${String(order.id)}`}
      ) on conflict (business_key) do nothing
    `;
    await transaction`
      update payment_orders
      set status = 'refunded', refunded_at = clock_timestamp(), updated_at = clock_timestamp()
      where id = ${String(order.id)}
    `;
    await this.completeInbox(transaction, String(inbox.id), String(outbox.id));
    return { outcome: "revoked" };
  }

  private async financialReview(
    transaction: TransactionSql,
    inbox: Row,
    outbox: Row,
    order: Row | null,
    reason: string,
  ): Promise<ProcessOutcome> {
    await transaction`
      insert into payment_financial_reviews (
        id, order_id, inbox_id, reason_code, status, created_at, updated_at
      ) values (
        ${randomUUID()}, ${order == null ? null : String(order.id)}, ${String(inbox.id)},
        ${reason}, 'open', clock_timestamp(), clock_timestamp()
      ) on conflict (inbox_id) do nothing
    `;
    if (order) {
      await transaction`
        update payment_orders set status = 'financial_review', updated_at = clock_timestamp()
        where id = ${String(order.id)} and status <> 'refunded'
      `;
    }
    await transaction`
      update payment_webhook_inbox
      set status = 'financial_review', last_error_code = ${reason},
          processed_at = clock_timestamp(), updated_at = clock_timestamp()
      where id = ${String(inbox.id)}
    `;
    await transaction`
      update payment_outbox
      set topic = 'financial_review', status = 'completed', last_error_code = ${reason},
          completed_at = clock_timestamp(), updated_at = clock_timestamp()
      where id = ${String(outbox.id)}
    `;
    return { outcome: "financial_review", reason };
  }

  private async completeInbox(transaction: TransactionSql, inboxId: string, outboxId: string): Promise<void> {
    await transaction`
      update payment_webhook_inbox
      set status = 'processed',
          last_error_code = case when attempt_count >= 3 then last_error_code else null end,
          processed_at = clock_timestamp(), updated_at = clock_timestamp()
      where id = ${inboxId}
    `;
    await transaction`
      update payment_outbox
      set status = 'completed', last_error_code = null,
          completed_at = clock_timestamp(), updated_at = clock_timestamp()
      where id = ${outboxId}
    `;
  }

  async recordProcessingFailure(inboxId: string, errorCode: string): Promise<{ deadLetter: boolean; attemptCount: number }> {
    return this.sql.begin(async (transaction) => {
      const rows = await transaction`
        select i.status as inbox_status, o.id as outbox_id, o.status as outbox_status,
          greatest(i.attempt_count, o.attempt_count) as attempt_count
        from payment_webhook_inbox i
        join payment_outbox o on o.inbox_id = i.id
        where i.id = ${inboxId}
        limit 1 for update of i, o
      ` as Row[];
      const row = rows[0];
      if (!row) throw new Error("PAYMENT_OUTBOX_UNAVAILABLE");
      const existingCount = Number(row.attempt_count);
      if (row.inbox_status === "dead_letter" || row.outbox_status === "dead_letter") {
        return { deadLetter: true, attemptCount: existingCount };
      }
      if (row.inbox_status === "processed" || row.outbox_status === "completed") {
        return { deadLetter: false, attemptCount: existingCount };
      }
      const attemptCount = existingCount + 1;
      const deadLetter = attemptCount >= 3;
      const code = safeFailureCode(errorCode);
      await transaction`
        update payment_webhook_inbox
        set status = ${deadLetter ? "dead_letter" : "failed"}, attempt_count = ${attemptCount},
            last_error_code = ${code}, updated_at = clock_timestamp()
        where id = ${inboxId}
      `;
      await transaction`
        update payment_outbox
        set status = ${deadLetter ? "dead_letter" : "failed"}, attempt_count = ${attemptCount},
            last_error_code = ${code}, updated_at = clock_timestamp()
        where id = ${String(row.outbox_id)}
      `;
      return { deadLetter, attemptCount };
    });
  }

  async replayDeadLetter(inboxId: string, reasonCode: string): Promise<boolean> {
    const reason = reasonCode.trim();
    if (!UUID_PATTERN.test(inboxId) || !/^[A-Z][A-Z0-9_]{0,55}$/.test(reason)) return false;
    const replayCode = `REPLAY_${reason}`;

    return this.sql.begin(async (transaction) => {
      const rows = await transaction`
        select i.status as inbox_status, o.id as outbox_id, o.status as outbox_status
        from payment_webhook_inbox i
        join payment_outbox o on o.inbox_id = i.id
        where i.id = ${inboxId}
        limit 1 for update of i, o
      ` as Row[];
      const row = rows[0];
      if (!row || row.inbox_status !== "dead_letter" || row.outbox_status !== "dead_letter") {
        return false;
      }

      await transaction`
        update payment_webhook_inbox
        set status = 'received', last_error_code = ${replayCode},
            processed_at = null, updated_at = clock_timestamp()
        where id = ${inboxId}
      `;
      await transaction`
        update payment_outbox
        set status = 'pending', available_at = clock_timestamp(),
            lease_token = null, lease_expires_at = null, completed_at = null,
            last_error_code = ${replayCode}, updated_at = clock_timestamp()
        where id = ${String(row.outbox_id)}
      `;
      return true;
    });
  }
}
