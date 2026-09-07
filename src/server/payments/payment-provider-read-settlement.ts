import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { AuthoritativePayment } from "./provider-authority";

type Row = Record<string, unknown>;

const RECOVERABLE_FINANCIAL_REVIEW_CODES = new Set([
  "CHECKOUT_EXPIRED",
  "CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN",
  "PAYMENT_PROVIDER_READ_UNAVAILABLE",
]);

export async function applyAuthoritativePaymentSettlement(
  sql: Sql,
  input: {
    orderId: string;
    payment: AuthoritativePayment;
    source: "provider_read_reconciliation";
    now: Date;
  },
): Promise<{ outcome: "succeeded" | "already_settled" | "financial_review" }> {
  if (!input.orderId || !Number.isFinite(input.now.getTime())) throw new Error("PAYMENT_RECOVERY_INVALID");

  return sql.begin(async (transaction) => {
    const rows = await transaction`
      select * from payment_orders where id = ${input.orderId} limit 1 for update
    ` as Row[];
    const order = rows[0];
    if (!order) throw new Error("PAYMENT_ORDER_NOT_FOUND");

    const payment = input.payment;
    const identityMatches = payment.model === "one_time"
      && payment.status === "succeeded"
      && payment.merchantOrderReference === input.orderId
      && String(order.provider) === "waffo"
      && String(order.provider_environment) === payment.environment
      && String(order.provider_product_id) === payment.providerProductId
      && Number(order.amount_minor) === payment.amountMinor
      && String(order.currency) === payment.currency;

    const markReview = async (reason: string) => {
      await transaction`
        update payment_orders
        set status = case when status = 'refunded' then status else 'financial_review' end,
            checkout_error_code = ${reason},
            provider_checkout_session_id = null,
            provider_checkout_url = null,
            checkout_claim_token = null,
            checkout_claim_expires_at = null,
            checkout_expires_at = null,
            updated_at = ${input.now}
        where id = ${input.orderId}
      `;
      await transaction`
        insert into audit_events (
          id, category, action, entity_type, entity_id, user_id, payload, created_at
        ) values (
          ${randomUUID()}, 'reconcile', 'payment_provider_read_financial_review', 'order',
          ${input.orderId}, ${String(order.user_id)}, ${JSON.stringify({
            source: input.source,
            reason,
          })}::jsonb, ${input.now}
        )
      `;
      return { outcome: "financial_review" as const };
    };

    if (!identityMatches) return markReview("PAYMENT_PROVIDER_READ_IDENTITY_MISMATCH");

    const status = String(order.status);
    if (status === "refunded") return markReview("PAYMENT_AFTER_REFUND");
    if (status === "financial_review") {
      const code = String(order.checkout_error_code ?? "");
      if (!RECOVERABLE_FINANCIAL_REVIEW_CODES.has(code)) {
        return { outcome: "financial_review" };
      }
    }

    if (status === "paid") {
      if (String(order.provider_order_id ?? "") !== payment.providerOrderId
        || String(order.provider_payment_id ?? "") !== payment.providerPaymentId) {
        return markReview("PAYMENT_PROVIDER_ID_MISMATCH");
      }
      const batch = await transaction`
        select id from entitlement_batches where order_id = ${input.orderId} limit 1 for update
      ` as Row[];
      if (!batch[0]) return markReview("ENTITLEMENT_BATCH_UNAVAILABLE");
      return { outcome: "already_settled" };
    }

    if (!["pending", "checkout_initializing", "checkout_created", "financial_review"].includes(status)) {
      return markReview("PAYMENT_ORDER_STATE_INVALID");
    }

    const providerConflict = await transaction`
      select id from payment_orders
      where id <> ${input.orderId}
        and provider = 'waffo'
        and provider_environment = ${payment.environment}
        and (provider_order_id = ${payment.providerOrderId} or provider_payment_id = ${payment.providerPaymentId})
      limit 1
    ` as Row[];
    if (providerConflict[0]) return markReview("PAYMENT_PROVIDER_ID_CONFLICT");

    const existingBatch = await transaction`
      select id from entitlement_batches where order_id = ${input.orderId} limit 1 for update
    ` as Row[];
    if (existingBatch[0]) return markReview("ENTITLEMENT_PREEXISTING_BEFORE_PAYMENT_SETTLEMENT");

    const batchId = randomUUID();
    await transaction`
      insert into entitlement_batches (
        id, user_id, order_id, quantity_total, quantity_available,
        quantity_reserved, quantity_consumed, quantity_revoked, expires_at,
        created_at, updated_at
      ) values (
        ${batchId}, ${String(order.user_id)}, ${input.orderId}, ${Number(order.quantity)},
        ${Number(order.quantity)}, 0, 0, 0, ${new Date(input.now.getTime() + 365 * 24 * 60 * 60 * 1000)},
        ${input.now}, ${input.now}
      )
    `;
    await transaction`
      insert into entitlement_ledger (
        id, batch_id, order_id, webhook_inbox_id, action, quantity, business_key, created_at
      ) values (
        ${randomUUID()}, ${batchId}, ${input.orderId}, null, 'grant', ${Number(order.quantity)},
        ${`grant:${input.orderId}`}, ${input.now}
      )
    `;
    await transaction`
      update payment_orders
      set provider_order_id = ${payment.providerOrderId},
          provider_payment_id = ${payment.providerPaymentId},
          provider_checkout_session_id = null,
          provider_checkout_url = null,
          checkout_claim_token = null,
          checkout_claim_expires_at = null,
          checkout_expires_at = null,
          checkout_error_code = null,
          status = 'paid',
          paid_at = coalesce(paid_at, ${input.now}),
          updated_at = ${input.now}
      where id = ${input.orderId}
    `;
    await transaction`
      insert into audit_events (
        id, category, action, entity_type, entity_id, user_id, payload, created_at
      ) values (
        ${randomUUID()}, 'reconcile', 'payment_recovered_provider_read', 'order',
        ${input.orderId}, ${String(order.user_id)}, ${JSON.stringify({
          source: input.source,
          providerOrderId: payment.providerOrderId,
          providerPaymentId: payment.providerPaymentId,
          quantity: Number(order.quantity),
        })}::jsonb, ${input.now}
      )
    `;

    return { outcome: "succeeded" };
  });
}
