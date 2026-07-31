import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { entitlementExpiry } from "@/domain/entitlements/pricing";
import { DomainError } from "@/server/errors/domain-error";

type ProductMapping = {
  internalProductId: string;
  quantity: number;
  amountUsd: number;
};

type BasePaymentEvent = {
  eventId: string;
  occurredAt: Date;
  payload: unknown;
};

export type CheckoutCompletedEvent = BasePaymentEvent & {
  eventType: "checkout.completed";
  checkoutId: string;
  providerOrderId: string;
  providerTransactionId: string | null;
  requestId: string;
  providerProductId: string;
  amountMinor: number;
  currency: string;
};

export type RefundCreatedEvent = BasePaymentEvent & {
  eventType: "refund.created";
  refundId: string;
  status: string;
  providerOrderId: string;
  providerTransactionId: string;
  amountMinor: number;
  currency: string;
};

export type DisputeCreatedEvent = BasePaymentEvent & {
  eventType: "dispute.created";
  disputeId: string;
  providerOrderId: string;
  providerTransactionId: string;
  amountMinor: number;
  currency: string;
};

export type CreemPaymentEvent = CheckoutCompletedEvent | RefundCreatedEvent | DisputeCreatedEvent;

export type PaymentProcessingOutcome = {
  processed: boolean;
  duplicate: boolean;
  orderId?: string;
  financialReviewRequired?: boolean;
};

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function paymentAuditPayload(event: CreemPaymentEvent): Record<string, unknown> {
  const common = {
    eventId: event.eventId,
    eventType: event.eventType,
    providerOrderId: event.providerOrderId,
    providerTransactionId: event.providerTransactionId,
    amountMinor: event.amountMinor,
    currency: event.currency,
    occurredAt: event.occurredAt.toISOString(),
  };
  if (event.eventType === "checkout.completed") {
    return {
      ...common,
      checkoutId: event.checkoutId,
      requestId: event.requestId,
      providerProductId: event.providerProductId,
    };
  }
  if (event.eventType === "refund.created") {
    return {
      ...common,
      refundId: event.refundId,
      status: event.status,
    };
  }
  return { ...common, disputeId: event.disputeId };
}

function mismatch(): never {
  throw new DomainError("CREEM_ORDER_MISMATCH", "Payment details did not match the order.", false);
}

function notReady(): never {
  throw new DomainError(
    "CREEM_ORDER_NOT_READY",
    "The related checkout has not been reconciled yet.",
    true,
  );
}

export class PostgresPaymentRepository {
  constructor(private readonly sql: Sql, private readonly config: {
    products: Record<string, ProductMapping>;
  }) {}

  processCheckoutCompleted(event: CheckoutCompletedEvent): Promise<PaymentProcessingOutcome> {
    return this.processEvent(event);
  }

  async processEvent(event: CreemPaymentEvent): Promise<PaymentProcessingOutcome> {
    return this.sql.begin(async (tx) => {
      const inserted = await tx`
        insert into webhook_inbox (
          provider, event_id, event_type, payload, signature_verified_at, created_at
        ) values (
          'creem', ${event.eventId}, ${event.eventType},
          ${tx.json(paymentAuditPayload(event) as never)},
          ${event.occurredAt}, ${event.occurredAt}
        )
        on conflict (provider, event_id) do nothing
        returning event_id
      `;
      if (inserted.length === 0) {
        return { processed: false, duplicate: true };
      }

      if (event.eventType === "checkout.completed") {
        const orders = await tx`
          select * from orders where request_id = ${event.requestId} for update
        `;
        const order = orders[0];
        const mapping = this.config.products[event.providerProductId];
        if (!order || !mapping) mismatch();

        const orderAmountMinor = Math.round(Number(order.amount_usd) * 100);
        if (
          order.product_id !== mapping.internalProductId
          || event.amountMinor !== Math.round(mapping.amountUsd * 100)
          || orderAmountMinor !== event.amountMinor
          || String(order.currency).toUpperCase() !== event.currency.toUpperCase()
        ) {
          mismatch();
        }

        if (order.status !== "pending") {
          if (
            order.provider_checkout_id !== event.checkoutId
            || order.provider_order_id !== event.providerOrderId
            || (order.provider_transaction_id && event.providerTransactionId
              && order.provider_transaction_id !== event.providerTransactionId)
          ) {
            mismatch();
          }
          await tx`
            update webhook_inbox set order_id = ${order.id}, processed_at = ${event.occurredAt}
            where provider = 'creem' and event_id = ${event.eventId}
          `;
          return {
            processed: true,
            duplicate: false,
            orderId: order.id,
            financialReviewRequired: Boolean(order.financial_review_required),
          };
        }

        const batchId = id("bat");
        const ledgerId = id("led");
        await tx`
          update orders set
            status = 'paid',
            provider_checkout_id = ${event.checkoutId},
            provider_order_id = ${event.providerOrderId},
            provider_transaction_id = ${event.providerTransactionId},
            provider_amount_minor = ${event.amountMinor},
            last_provider_event_at = ${event.occurredAt},
            updated_at = ${event.occurredAt}
          where id = ${order.id}
        `;
        await tx`
          insert into entitlement_batches (
            id, user_id, product_id, order_id, amount_usd,
            quantity_total, quantity_available, quantity_reserved, quantity_consumed,
            quantity_revoked, expires_at, created_at, updated_at
          ) values (
            ${batchId}, ${order.user_id}, ${mapping.internalProductId}, ${order.id}, ${mapping.amountUsd},
            ${mapping.quantity}, ${mapping.quantity}, 0, 0, 0,
            ${entitlementExpiry(event.occurredAt)}, ${event.occurredAt}, ${event.occurredAt}
          )
        `;
        await tx`
          insert into entitlement_ledger (
            id, batch_id, order_id, webhook_event_id, action, quantity, reason_code, created_at
          ) values (
            ${ledgerId}, ${batchId}, ${order.id}, ${event.eventId},
            'grant', ${mapping.quantity}, 'checkout_completed', ${event.occurredAt}
          )
        `;
        await tx`
          update webhook_inbox set order_id = ${order.id}, processed_at = ${event.occurredAt}
          where provider = 'creem' and event_id = ${event.eventId}
        `;
        return { processed: true, duplicate: false, orderId: order.id };
      }

      const orders = await tx`
        select * from orders where provider_order_id = ${event.providerOrderId} for update
      `;
      const order = orders[0];
      if (!order || order.status === "pending" || !order.provider_amount_minor) notReady();
      if (
        String(order.currency).toUpperCase() !== event.currency.toUpperCase()
        || (order.provider_transaction_id
          && order.provider_transaction_id !== event.providerTransactionId)
      ) {
        mismatch();
      }

      if (event.eventType === "refund.created" && event.status.toLowerCase() !== "succeeded") {
        await tx`
          update webhook_inbox set order_id = ${order.id}, processed_at = ${event.occurredAt}
          where provider = 'creem' and event_id = ${event.eventId}
        `;
        return {
          processed: true,
          duplicate: false,
          orderId: order.id,
          financialReviewRequired: Boolean(order.financial_review_required),
        };
      }

      const batches = await tx`
        select * from entitlement_batches where order_id = ${order.id} for update
      `;
      const batch = batches[0];
      if (!batch) notReady();
      const priorRevocationRows = await tx`
        select coalesce(sum(quantity), 0)::integer as quantity
        from entitlement_ledger
        where order_id = ${order.id} and action = 'revoke'
          and reason_code in ('refund', 'dispute')
      `;
      const previouslyRevoked = Number(priorRevocationRows[0].quantity);
      const quantityTotal = Number(batch.quantity_total);
      const quantityAvailable = Number(batch.quantity_available);
      let requestedTarget: number;
      let nextRefundedAmount = Number(order.refunded_amount_minor);
      let nextStatus: "partially_refunded" | "refunded" | "disputed";
      let reasonCode: "refund" | "dispute";

      if (event.eventType === "refund.created") {
        nextRefundedAmount += event.amountMinor;
        requestedTarget = Math.ceil(
          quantityTotal
          * Math.min(nextRefundedAmount, Number(order.provider_amount_minor))
          / Number(order.provider_amount_minor),
        );
        nextStatus = nextRefundedAmount >= Number(order.provider_amount_minor)
          ? "refunded"
          : "partially_refunded";
        if (order.status === "disputed") nextStatus = "disputed";
        reasonCode = "refund";
      } else {
        requestedTarget = quantityTotal;
        nextStatus = "disputed";
        reasonCode = "dispute";
      }

      const revokeNeeded = Math.max(0, requestedTarget - previouslyRevoked);
      const revokeNow = Math.min(quantityAvailable, revokeNeeded);
      const financialReviewRequired = Boolean(order.financial_review_required)
        || revokeNow < revokeNeeded
        || (event.eventType === "refund.created"
          && nextRefundedAmount > Number(order.provider_amount_minor));

      if (revokeNow > 0) {
        await tx`
          update entitlement_batches set
            quantity_available = quantity_available - ${revokeNow},
            quantity_revoked = quantity_revoked + ${revokeNow},
            updated_at = ${event.occurredAt}
          where id = ${batch.id}
        `;
        await tx`
          insert into entitlement_ledger (
            id, batch_id, order_id, webhook_event_id, action, quantity, reason_code, created_at
          ) values (
            ${id("led")}, ${batch.id}, ${order.id}, ${event.eventId},
            'revoke', ${revokeNow}, ${reasonCode}, ${event.occurredAt}
          )
        `;
      }

      await tx`
        update orders set
          status = ${nextStatus},
          provider_transaction_id = coalesce(provider_transaction_id, ${event.providerTransactionId}),
          refunded_amount_minor = ${nextRefundedAmount},
          financial_review_required = ${financialReviewRequired},
          last_provider_event_at = ${event.occurredAt},
          updated_at = ${event.occurredAt}
        where id = ${order.id}
      `;
      await tx`
        update webhook_inbox set order_id = ${order.id}, processed_at = ${event.occurredAt}
        where provider = 'creem' and event_id = ${event.eventId}
      `;
      return {
        processed: true,
        duplicate: false,
        orderId: order.id,
        financialReviewRequired,
      };
    });
  }
}
