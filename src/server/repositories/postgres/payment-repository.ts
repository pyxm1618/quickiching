import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { entitlementExpiry, PRODUCTS } from "@/domain/entitlements/pricing";
import type { PaymentEvent } from "@/server/payments/provider";
import type { PaymentEventRepository } from "@/server/payments/payment-event-service";

type PostgresJsonValue = Parameters<Sql["json"]>[0];

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export class PostgresPaymentRepository implements PaymentEventRepository {
  constructor(private readonly sql: Sql) {}

  async claimEvent(event: PaymentEvent): Promise<boolean> {
    const payload = JSON.parse(JSON.stringify(event.raw)) as PostgresJsonValue;
    const inserted = await this.sql`
      insert into webhook_inbox (
        provider, event_id, event_type, payload, signature_verified_at, created_at
      ) values (
        'creem', ${event.providerEventId}, ${event.type}, ${this.sql.json(payload)}, now(), now()
      )
      on conflict (provider, event_id) do nothing
      returning event_id
    `;
    return inserted.length === 1;
  }

  async releaseEvent(event: PaymentEvent, error: unknown): Promise<void> {
    void error;
    await this.sql`
      delete from webhook_inbox
      where provider = 'creem'
        and event_id = ${event.providerEventId}
        and processed_at is null
    `;
  }

  async applyCheckoutCompleted(event: PaymentEvent): Promise<void> {
    await this.sql.begin(async (tx) => {
      const [order] = await tx`select * from orders where id = ${event.orderId} for update`;
      if (!order) throw new Error("ORDER_NOT_FOUND");
      if (order.status === "paid") {
        await tx`
          update webhook_inbox set processed_at = now(), processing_error_code = null
          where provider = 'creem' and event_id = ${event.providerEventId}
        `;
        return;
      }
      if (order.status !== "pending") throw new Error("ORDER_PAYMENT_STATE_INVALID");
      if (order.provider_checkout_id && order.provider_checkout_id !== event.providerCheckoutId) {
        throw new Error("ORDER_CHECKOUT_MISMATCH");
      }
      const product = PRODUCTS[order.product_id as keyof typeof PRODUCTS];
      if (!product) throw new Error("ORDER_PRODUCT_INVALID");
      const now = new Date();
      const proposedBatchId = id("bat");
      await tx`
        update orders set status = 'paid', provider_checkout_id = ${event.providerCheckoutId}, updated_at = ${now}
        where id = ${event.orderId}
      `;
      const insertedBatches = await tx`
        insert into entitlement_batches (
          id, user_id, product_id, amount_usd, quantity_total, quantity_available,
          quantity_reserved, quantity_consumed, quantity_revoked, expires_at,
          created_at, updated_at, order_id
        ) values (
          ${proposedBatchId}, ${order.user_id}, ${order.product_id}, ${order.amount_usd},
          ${product.quantity}, ${product.quantity}, 0, 0, 0, ${entitlementExpiry(now)},
          ${now}, ${now}, ${event.orderId}
        )
        on conflict (order_id) where order_id is not null do nothing
        returning id
      `;
      const batchId = insertedBatches[0]?.id
        ?? (await tx`select id from entitlement_batches where order_id = ${event.orderId}`)[0]?.id;
      if (!batchId) throw new Error("ENTITLEMENT_BATCH_NOT_CREATED");
      await tx`
        insert into entitlement_ledger (id, batch_id, action, quantity, created_at)
        values (${`led_${event.providerEventId}`}, ${batchId}, 'grant', ${product.quantity}, ${now})
        on conflict (id) do nothing
      `;
      await tx`
        update webhook_inbox set processed_at = now(), processing_error_code = null
        where provider = 'creem' and event_id = ${event.providerEventId}
      `;
    });
  }

  async applyRefund(event: PaymentEvent): Promise<void> {
    await this.revokeAvailable(event, "refunded");
  }

  async applyDispute(event: PaymentEvent): Promise<void> {
    await this.revokeAvailable(event, "disputed");
  }

  private async revokeAvailable(event: PaymentEvent, status: "refunded" | "disputed"): Promise<void> {
    await this.sql.begin(async (tx) => {
      const [order] = await tx`select * from orders where id = ${event.orderId} for update`;
      if (!order) throw new Error("ORDER_NOT_FOUND");
      if (order.status !== status) {
        await tx`update orders set status = ${status}, updated_at = now() where id = ${event.orderId}`;
      }
      const [batch] = await tx`
        select * from entitlement_batches where order_id = ${event.orderId} for update
      `;
      if (batch && Number(batch.quantity_available) > 0) {
        const available = Number(batch.quantity_available);
        await tx`
          update entitlement_batches set
            quantity_available = 0,
            quantity_revoked = quantity_revoked + ${available},
            updated_at = now()
          where id = ${batch.id}
        `;
        await tx`
          insert into entitlement_ledger (id, batch_id, action, quantity, created_at)
          values (${`led_${event.providerEventId}`}, ${batch.id}, 'revoke', ${available}, now())
          on conflict (id) do nothing
        `;
      }
      if (status === "refunded") {
        await tx`
          insert into refunds (id, order_id, provider_refund_id, amount_usd, status, created_at)
          values (${`ref_${event.providerEventId}`}, ${event.orderId}, ${event.providerEventId}, ${order.amount_usd}, 'created', now())
          on conflict (provider_refund_id) do nothing
        `;
      } else {
        await tx`
          insert into disputes (id, order_id, provider_dispute_id, status, created_at, updated_at)
          values (${`dsp_${event.providerEventId}`}, ${event.orderId}, ${event.providerEventId}, 'created', now(), now())
          on conflict (provider_dispute_id) do nothing
        `;
      }
      await tx`
        update webhook_inbox set processed_at = now(), processing_error_code = null
        where provider = 'creem' and event_id = ${event.providerEventId}
      `;
    });
  }
}
