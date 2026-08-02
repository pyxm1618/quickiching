import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { entitlementExpiry } from "@/domain/entitlements/pricing";
import { DomainError } from "@/server/errors/domain-error";
import { parseWaffoWebhook, usdMinor, type WaffoWebhook } from "@/server/payments/waffo-webhook";

type ProductMapping = { internalProductId: string; quantity: number; amountUsd: number };
export type PaymentProcessingOutcome = { processed: boolean; duplicate: boolean; orderId?: string; financialReviewRequired?: boolean };
const provider = "waffo";
const topic = "payment.webhook.received";
const id = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "")}`;
const supported = new Set(["order.completed", "refund.succeeded", "refund.failed"]);
const mismatch = (): never => { throw new DomainError("WAFFO_ORDER_MISMATCH", "Payment details did not match the order.", false); };
const notReady = (): never => { throw new DomainError("WAFFO_ORDER_NOT_READY", "The related order is not ready for reconciliation.", true); };
const localMinor = (amount: number) => usdMinor(amount.toFixed(2));
const boundedCode = (error: unknown) => (error instanceof DomainError ? error.code : "WAFFO_PROCESSING_FAILED").slice(0, 80);

function taxAmounts(event: WaffoWebhook): { subtotal: number; tax: number; total: number } {
  const amount = usdMinor(event.data.amount);
  const tax = usdMinor(event.data.taxAmount);
  const total = event.data.total ? usdMinor(event.data.total) : amount;
  const subtotal = event.data.subtotal ? usdMinor(event.data.subtotal) : total - tax;
  if (subtotal < 0 || subtotal + tax !== total || total !== amount) mismatch();
  return { subtotal, tax, total };
}

export class PostgresPaymentRepository {
  constructor(private readonly sql: Sql, private readonly config: { products: Record<string, ProductMapping> }) {}

  /** Stores verified bytes and its work item atomically; repairs an old Inbox row missing its work item. */
  async recordVerifiedDelivery(event: WaffoWebhook, rawPayload: unknown): Promise<{ recorded: boolean; outboxRepaired: boolean }> {
    return this.sql.begin(async (tx) => {
      const inserted = await tx`insert into webhook_inbox (provider, delivery_id, event_id, event_type, mode, store_id, payload, signature_verified_at, created_at)
        values (${provider}, ${event.id}, ${event.eventId}, ${event.eventType}, ${event.mode}, ${event.storeId}, ${tx.json({ raw: rawPayload, validated: event } as never)}, now(), now())
        on conflict do nothing returning delivery_id`;
      const inbox = inserted[0] ?? (await tx`select delivery_id from webhook_inbox where provider = ${provider} and event_type = ${event.eventType} and event_id = ${event.eventId} for update`)[0];
      if (!inbox) return { recorded: false, outboxRepaired: false };
      const deliveryId = String(inbox.delivery_id);
      const created = await tx`insert into outbox (id, topic, aggregate_id, payload, available_at, created_at)
        values (${id("out")}, ${topic}, ${deliveryId}, ${tx.json({ provider, deliveryId } as never)}, now(), now())
        on conflict (topic, aggregate_id) where topic = ${topic} do nothing returning id`;
      return { recorded: inserted.length === 1, outboxRepaired: created.length === 1 && inserted.length === 0 };
    });
  }

  async processEvent(event: WaffoWebhook): Promise<PaymentProcessingOutcome> {
    return this.sql.begin(async (tx) => {
      const inbox = (await tx`select * from webhook_inbox where provider = ${provider} and delivery_id = ${event.id} for update`)[0];
      if (!inbox) notReady();
      if (inbox.processed_at) return { processed: false, duplicate: true };
      if (!supported.has(event.eventType)) {
        await tx`update webhook_inbox set processed_at = now(), processing_error_code = null where provider = ${provider} and delivery_id = ${event.id}`;
        return { processed: true, duplicate: false };
      }
      const orderId = event.data.orderMerchantExternalId;
      if (!orderId) throw new DomainError("WAFFO_ORDER_MISMATCH", "Payment details did not match the order.", false);
      const order = (await tx`select * from orders where id = ${orderId} for update`)[0];
      if (!order) notReady();
      const metadata = event.data.orderMetadata;
      if (!metadata || metadata.orderId !== order.id || metadata.internalProductId !== order.product_id) mismatch();
      const mapping = Object.values(this.config.products).find((candidate) => candidate.internalProductId === order.product_id);
      if (!mapping) throw new DomainError("WAFFO_ORDER_MISMATCH", "Payment details did not match the order.", false);
      if (event.data.currency.toUpperCase() !== "USD" || String(order.currency).toUpperCase() !== "USD") mismatch();
      const amounts = taxAmounts(event);

      if (event.eventType === "refund.failed") {
        await tx`update orders set financial_review_required = true, last_provider_event_at = ${event.timestamp}, updated_at = now() where id = ${order.id}`;
        await tx`update webhook_inbox set order_id = ${order.id}, processed_at = now(), processing_error_code = 'WAFFO_REFUND_FAILED' where provider = ${provider} and delivery_id = ${event.id}`;
        return { processed: true, duplicate: false, orderId: order.id, financialReviewRequired: true };
      }

      if (event.eventType === "order.completed") {
        // Products are configured taxExcluded: local USD price equals Waffo subtotal, never a presumed total.
        if (amounts.subtotal !== localMinor(mapping.amountUsd) || amounts.subtotal !== localMinor(Number(order.amount_usd))) mismatch();
        if (event.data.merchantProvidedBuyerIdentity !== order.user_id) mismatch();
        if (order.status !== "pending") {
          if (order.provider_order_id !== event.data.orderId || order.provider_transaction_id !== event.data.paymentId) mismatch();
        } else {
          await tx`update orders set status = 'paid', provider_order_id = ${event.data.orderId}, provider_transaction_id = ${event.data.paymentId ?? event.eventId}, provider_amount_minor = ${amounts.total}, provider_subtotal_minor = ${amounts.subtotal}, provider_tax_amount_minor = ${amounts.tax}, provider_total_minor = ${amounts.total}, last_provider_event_at = ${event.timestamp}, updated_at = now() where id = ${order.id}`;
          const batchId = id("bat");
          await tx`insert into entitlement_batches (id, user_id, product_id, order_id, amount_usd, quantity_total, quantity_available, quantity_reserved, quantity_consumed, quantity_revoked, expires_at) values (${batchId}, ${order.user_id}, ${mapping.internalProductId}, ${order.id}, ${mapping.amountUsd}, ${mapping.quantity}, ${mapping.quantity}, 0, 0, 0, ${entitlementExpiry(new Date(event.timestamp))})`;
          await tx`insert into entitlement_ledger (id, batch_id, order_id, webhook_event_id, action, quantity, reason_code) values (${id("led")}, ${batchId}, ${order.id}, ${event.eventId}, 'grant', ${mapping.quantity}, 'order_completed')`;
        }
      } else {
        if (order.status === "pending" || !order.provider_total_minor || order.provider_order_id !== event.data.orderId || order.provider_transaction_id !== event.data.paymentId) notReady();
        const batch = (await tx`select * from entitlement_batches where order_id = ${order.id} for update`)[0];
        if (!batch) notReady();
        const refunded = Number(order.refunded_amount_minor) + amounts.total;
        const target = Math.ceil(Number(batch.quantity_total) * Math.min(refunded, Number(order.provider_total_minor)) / Number(order.provider_total_minor));
        const prior = Number((await tx`select coalesce(sum(quantity), 0)::integer as quantity from entitlement_ledger where order_id = ${order.id} and action = 'revoke'`)[0].quantity);
        const needed = Math.max(0, target - prior);
        const revoke = Math.min(Number(batch.quantity_available), needed);
        const review = Boolean(order.financial_review_required) || revoke < needed || refunded > Number(order.provider_total_minor);
        if (revoke) {
          await tx`update entitlement_batches set quantity_available = quantity_available - ${revoke}, quantity_revoked = quantity_revoked + ${revoke}, updated_at = now() where id = ${batch.id}`;
          await tx`insert into entitlement_ledger (id, batch_id, order_id, webhook_event_id, action, quantity, reason_code) values (${id("led")}, ${batch.id}, ${order.id}, ${event.eventId}, 'revoke', ${revoke}, 'refund')`;
        }
        await tx`update orders set status = ${refunded >= Number(order.provider_total_minor) ? "refunded" : "partially_refunded"}, refunded_amount_minor = ${refunded}, financial_review_required = ${review}, last_provider_event_at = ${event.timestamp}, updated_at = now() where id = ${order.id}`;
      }
      await tx`update webhook_inbox set order_id = ${order.id}, processed_at = now(), processing_error_code = null where provider = ${provider} and delivery_id = ${event.id}`;
      return { processed: true, duplicate: false, orderId: order.id, financialReviewRequired: Boolean(order.financial_review_required) };
    });
  }

  /** Claims rows with SKIP LOCKED; a crashed worker's lease expires through available_at. */
  async dispatchPending(limit = 25): Promise<{ dispatched: number; failed: number }> {
    const claimed = await this.sql.begin(async (tx) => tx`with candidates as (
      select id from outbox where topic = ${topic} and dispatched_at is null and dead_lettered_at is null and available_at <= now()
      order by created_at for update skip locked limit ${limit}
    ) update outbox set attempts = attempts + 1, available_at = now() + interval '5 minutes'
      where id in (select id from candidates) returning id, aggregate_id, attempts`);
    let dispatched = 0; let failed = 0;
    for (const row of claimed) {
      try {
        const inbox = (await this.sql`select payload from webhook_inbox where provider = ${provider} and delivery_id = ${row.aggregate_id}`)[0];
        const event = parseWaffoWebhook((inbox?.payload as { validated?: unknown } | undefined)?.validated);
        await this.processEvent(event);
        await this.sql`update outbox set dispatched_at = now() where id = ${row.id} and dispatched_at is null`;
        dispatched++;
      } catch (error) {
        const retryable = error instanceof DomainError && error.retryable;
        const exhausted = Number(row.attempts) >= 8;
        const delayMs = Math.min(60 * 60_000, 1_000 * 2 ** Math.min(Number(row.attempts), 12));
        await this.sql.begin(async (tx) => {
          await tx`update webhook_inbox set processing_error_code = ${boundedCode(error)} where provider = ${provider} and delivery_id = ${row.aggregate_id} and processed_at is null`;
          await tx`update outbox set failed_at = now(), last_error_code = ${boundedCode(error)}, dead_lettered_at = case when ${!retryable || exhausted} then now() else dead_lettered_at end, available_at = case when ${retryable && !exhausted} then now() + (${delayMs} * interval '1 millisecond') else available_at end where id = ${row.id} and dispatched_at is null`;
        });
        failed++;
      }
    }
    return { dispatched, failed };
  }
}
