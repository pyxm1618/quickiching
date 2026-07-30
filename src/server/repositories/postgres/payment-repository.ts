import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { entitlementExpiry } from "@/domain/entitlements/pricing";
import { DomainError } from "@/server/errors/domain-error";

type ProductMapping = {
  internalProductId: string;
  quantity: number;
  amountUsd: number;
};

export type CheckoutCompletedEvent = {
  eventId: string;
  eventType: "checkout.completed";
  checkoutId: string;
  requestId: string;
  providerProductId: string;
  amountMinor: number;
  currency: string;
  occurredAt: Date;
  payload: unknown;
};

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function mismatch(): never {
  throw new DomainError("CREEM_ORDER_MISMATCH", "Payment details did not match the order.", false);
}

export class PostgresPaymentRepository {
  constructor(private readonly sql: Sql, private readonly config: {
    products: Record<string, ProductMapping>;
  }) {}

  async processCheckoutCompleted(event: CheckoutCompletedEvent): Promise<{
    processed: boolean;
    duplicate: boolean;
    orderId?: string;
  }> {
    return this.sql.begin(async (tx) => {
      const inserted = await tx`
        insert into webhook_inbox (
          provider, event_id, event_type, payload, signature_verified_at, created_at
        ) values (
          'creem', ${event.eventId}, ${event.eventType}, ${tx.json(event.payload as never)},
          ${event.occurredAt}, ${event.occurredAt}
        )
        on conflict (provider, event_id) do nothing
        returning event_id
      `;
      if (inserted.length === 0) {
        return { processed: false, duplicate: true };
      }

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

      if (order.status === "paid") {
        if (order.provider_checkout_id !== event.checkoutId) mismatch();
        await tx`
          update webhook_inbox set processed_at = ${event.occurredAt}
          where provider = 'creem' and event_id = ${event.eventId}
        `;
        return { processed: true, duplicate: false, orderId: order.id };
      }
      if (order.status !== "pending") mismatch();

      const batchId = id("bat");
      const ledgerId = id("led");
      await tx`
        update orders set
          status = 'paid', provider_checkout_id = ${event.checkoutId}, updated_at = ${event.occurredAt}
        where id = ${order.id}
      `;
      await tx`
        insert into entitlement_batches (
          id, user_id, product_id, amount_usd, quantity_total, quantity_available,
          quantity_reserved, quantity_consumed, quantity_revoked, expires_at, created_at, updated_at
        ) values (
          ${batchId}, ${order.user_id}, ${mapping.internalProductId}, ${mapping.amountUsd},
          ${mapping.quantity}, ${mapping.quantity}, 0, 0, 0,
          ${entitlementExpiry(event.occurredAt)}, ${event.occurredAt}, ${event.occurredAt}
        )
      `;
      await tx`
        insert into entitlement_ledger (id, batch_id, action, quantity, created_at)
        values (${ledgerId}, ${batchId}, 'grant', ${mapping.quantity}, ${event.occurredAt})
      `;
      await tx`
        update webhook_inbox set processed_at = ${event.occurredAt}
        where provider = 'creem' and event_id = ${event.eventId}
      `;
      return { processed: true, duplicate: false, orderId: order.id };
    });
  }
}
