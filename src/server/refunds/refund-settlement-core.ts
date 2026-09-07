import { randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";

type Row = Record<string, unknown>;

type RefundSettlementInput = {
  refundId: string;
  orderId: string;
  environment: "test" | "prod";
  providerOrderId: string;
  providerPaymentId: string;
  amountMinor: number;
  currency: "USD";
  providerTicketId: string | null;
  providerRefundId: string | null;
  status: "succeeded" | "failed";
  source: "provider_read" | "webhook";
  webhookInboxId: string | null;
  reconcileLeaseToken?: string;
  now: Date;
};

export type RefundSettlementResult = {
  outcome: "succeeded" | "failed" | "already_settled" | "financial_review";
};

function nullableString(value: unknown): string | null {
  return value == null ? null : String(value);
}

function referenceCompatible(existing: unknown, incoming: string | null): boolean {
  if (incoming == null) return true;
  const current = nullableString(existing);
  return current == null || current === incoming;
}

async function markFinancialReview(
  transaction: TransactionSql,
  input: RefundSettlementInput,
  reason: string,
  options: { preserveRefundStatus?: boolean } = {},
): Promise<RefundSettlementResult> {
  if (options.preserveRefundStatus) {
    await transaction`
      update refund_intents
      set last_error_code = ${reason},
          next_reconcile_at = null,
          reconcile_lease_token = null,
          reconcile_lease_expires_at = null,
          updated_at = ${input.now.toISOString()}
      where id = ${input.refundId}
    `;
  } else {
    await transaction`
      update refund_intents
      set status = 'reconciliation_required',
          last_error_code = ${reason},
          next_reconcile_at = null,
          reconcile_lease_token = null,
          reconcile_lease_expires_at = null,
          updated_at = ${input.now.toISOString()}
      where id = ${input.refundId}
    `;
  }
  await transaction`
    update payment_orders
    set status = case when status = 'refunded' then status else 'financial_review' end,
        updated_at = ${input.now.toISOString()}
    where id = ${input.orderId}
  `;
  if (input.webhookInboxId) {
    await transaction`
      insert into payment_financial_reviews (
        id, order_id, inbox_id, reason_code, status, created_at, updated_at
      ) values (
        ${randomUUID()}, ${input.orderId}, ${input.webhookInboxId}, ${reason},
        'open', ${input.now.toISOString()}, ${input.now.toISOString()}
      ) on conflict (inbox_id) do nothing
    `;
  }
  await transaction`
    insert into audit_events (
      id, category, action, entity_type, entity_id, payload, created_at
    ) values (
      ${randomUUID()}, 'reconcile', 'refund_settlement_financial_review',
      'refund_intent', ${input.refundId}, ${JSON.stringify({
        source: input.source,
        orderId: input.orderId,
        reason,
      })}::jsonb, ${input.now.toISOString()}
    )
  `;
  return { outcome: "financial_review" };
}

function settlementIdentityMatches(order: Row, refund: Row, input: RefundSettlementInput): boolean {
  return String(order.id) === input.orderId
    && String(refund.order_id) === input.orderId
    && String(order.user_id) === String(refund.user_id)
    && String(order.provider) === "waffo"
    && String(order.provider_environment) === input.environment
    && String(refund.provider_environment) === input.environment
    && String(order.provider_order_id ?? "") === input.providerOrderId
    && String(order.provider_payment_id ?? "") === input.providerPaymentId
    && Number(order.amount_minor) === input.amountMinor
    && Number(refund.requested_minor) === input.amountMinor
    && String(order.currency) === input.currency
    && String(refund.currency) === input.currency;
}

async function fillProviderReferences(
  transaction: TransactionSql,
  refund: Row,
  input: RefundSettlementInput,
): Promise<boolean> {
  if (!referenceCompatible(refund.provider_ticket_id, input.providerTicketId)
    || !referenceCompatible(refund.provider_refund_id, input.providerRefundId)) {
    return false;
  }
  const ticket = input.providerTicketId ?? nullableString(refund.provider_ticket_id);
  const providerRefund = input.providerRefundId ?? nullableString(refund.provider_refund_id);
  await transaction`
    update refund_intents
    set provider_ticket_id = ${ticket},
        provider_refund_id = ${providerRefund},
        updated_at = ${input.now.toISOString()}
    where id = ${input.refundId}
  `;
  return true;
}

export async function applyRefundSettlement(
  sql: Sql,
  input: RefundSettlementInput,
): Promise<RefundSettlementResult> {
  if (!input.refundId || !input.orderId || !input.providerOrderId || !input.providerPaymentId) {
    throw new Error("REFUND_SETTLEMENT_INVALID");
  }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0 || input.currency !== "USD") {
    throw new Error("REFUND_SETTLEMENT_INVALID");
  }
  if (!Number.isFinite(input.now.getTime())) throw new Error("REFUND_SETTLEMENT_INVALID");

  return sql.begin(async (transaction) => {
    const orderRows = await transaction`
      select * from payment_orders where id = ${input.orderId} limit 1 for update
    ` as Row[];
    const order = orderRows[0];
    if (!order) throw new Error("REFUND_ORDER_NOT_FOUND");

    const refundRows = await transaction`
      select * from refund_intents where id = ${input.refundId} and order_id = ${input.orderId}
      limit 1 for update
    ` as Row[];
    const refund = refundRows[0];
    if (!refund) throw new Error("REFUND_INTENT_NOT_FOUND");
    if (input.reconcileLeaseToken !== undefined
      && String(refund.reconcile_lease_token ?? "") !== input.reconcileLeaseToken) {
      throw new Error("REFUND_RECONCILE_LEASE_LOST");
    }

    if (!settlementIdentityMatches(order, refund, input)) {
      return markFinancialReview(transaction, input, "REFUND_SETTLEMENT_IDENTITY_MISMATCH");
    }
    if (!referenceCompatible(refund.provider_ticket_id, input.providerTicketId)
      || !referenceCompatible(refund.provider_refund_id, input.providerRefundId)) {
      return markFinancialReview(transaction, input, "REFUND_PROVIDER_REFERENCE_CONFLICT");
    }

    const currentStatus = String(refund.status);
    if (currentStatus === "succeeded") {
      if (input.status !== "succeeded") {
        return markFinancialReview(
          transaction,
          input,
          "REFUND_SETTLEMENT_STATUS_CONFLICT",
          { preserveRefundStatus: true },
        );
      }
      const filled = await fillProviderReferences(transaction, refund, input);
      if (!filled) return markFinancialReview(transaction, input, "REFUND_PROVIDER_REFERENCE_CONFLICT");
      return { outcome: "already_settled" };
    }
    if (currentStatus === "failed") {
      if (input.status !== "failed") {
        return markFinancialReview(
          transaction,
          input,
          "REFUND_SETTLEMENT_STATUS_CONFLICT",
          { preserveRefundStatus: true },
        );
      }
      const filled = await fillProviderReferences(transaction, refund, input);
      if (!filled) return markFinancialReview(transaction, input, "REFUND_PROVIDER_REFERENCE_CONFLICT");
      return { outcome: "already_settled" };
    }

    if (refund.approved_at == null) {
      return markFinancialReview(transaction, input, "REFUND_SETTLEMENT_NOT_APPROVED");
    }

    if (input.status === "failed") {
      await transaction`
        update refund_intents
        set provider_write_state = 'confirmed',
            provider_ticket_id = ${input.providerTicketId},
            provider_refund_id = ${input.providerRefundId},
            status = 'failed',
            next_reconcile_at = null,
            reconcile_lease_token = null,
            reconcile_lease_expires_at = null,
            last_error_code = 'REFUND_PROVIDER_REPORTED_FAILED',
            updated_at = ${input.now.toISOString()}
        where id = ${input.refundId}
      `;
      await transaction`
        insert into audit_events (
          id, category, action, entity_type, entity_id, payload, created_at
        ) values (
          ${randomUUID()}, 'reconcile', 'refund_settlement_failed', 'refund_intent',
          ${input.refundId}, ${JSON.stringify({ source: input.source, orderId: input.orderId })}::jsonb,
          ${input.now.toISOString()}
        )
      `;
      return { outcome: "failed" };
    }

    if (String(order.status) === "refunded") {
      return markFinancialReview(transaction, input, "REFUND_ORDER_ALREADY_REFUNDED_WITHOUT_INTENT_SETTLEMENT");
    }
    if (String(order.status) !== "paid" && String(order.status) !== "financial_review") {
      return markFinancialReview(transaction, input, "REFUND_ORDER_STATE_INVALID");
    }

    const batchRows = await transaction`
      select * from entitlement_batches where order_id = ${input.orderId} limit 1 for update
    ` as Row[];
    const batch = batchRows[0];
    if (!batch) return markFinancialReview(transaction, input, "REFUND_ENTITLEMENT_SOURCE_UNAVAILABLE");
    if (
      Number(batch.quantity_available) !== Number(batch.quantity_total)
      || Number(batch.quantity_reserved) !== 0
      || Number(batch.quantity_consumed) !== 0
      || Number(batch.quantity_revoked) !== 0
    ) {
      return markFinancialReview(transaction, input, "REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE");
    }

    const quantity = Number(batch.quantity_total);
    await transaction`
      update entitlement_batches
      set quantity_available = 0,
          quantity_revoked = ${quantity},
          updated_at = ${input.now.toISOString()}
      where id = ${String(batch.id)}
    `;
    await transaction`
      insert into entitlement_ledger (
        id, batch_id, order_id, webhook_inbox_id, action, quantity, business_key, created_at
      ) values (
        ${randomUUID()}, ${String(batch.id)}, ${input.orderId}, ${input.webhookInboxId},
        'revoke', ${quantity}, ${`revoke:${input.orderId}`}, ${input.now.toISOString()}
      ) on conflict (business_key) do nothing
    `;
    await transaction`
      update payment_orders
      set status = 'refunded', refunded_at = coalesce(refunded_at, ${input.now.toISOString()}), updated_at = ${input.now.toISOString()}
      where id = ${input.orderId}
    `;
    await transaction`
      update refund_intents
      set provider_write_state = 'confirmed',
          provider_ticket_id = ${input.providerTicketId},
          provider_refund_id = ${input.providerRefundId},
          status = 'succeeded',
          next_reconcile_at = null,
          reconcile_lease_token = null,
          reconcile_lease_expires_at = null,
          last_error_code = null,
          updated_at = ${input.now.toISOString()}
      where id = ${input.refundId}
    `;
    await transaction`
      insert into audit_events (
        id, category, action, entity_type, entity_id, payload, created_at
      ) values (
        ${randomUUID()}, 'reconcile', 'refund_settlement_succeeded', 'refund_intent',
        ${input.refundId}, ${JSON.stringify({
          source: input.source,
          orderId: input.orderId,
          quantityRevoked: quantity,
        })}::jsonb, ${input.now.toISOString()}
      )
    `;
    return { outcome: "succeeded" };
  });
}
