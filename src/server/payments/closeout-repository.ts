import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { NormalizedWaffoWebhook } from "./waffo-webhook";
import { PostgresPaymentRepository } from "./postgres-repository";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;

export class CloseoutPaymentRepository extends PostgresPaymentRepository {
  constructor(
    private readonly closeoutSql: Sql,
    options: ConstructorParameters<typeof PostgresPaymentRepository>[1] = {},
  ) {
    super(closeoutSql, options);
  }

  private async existingProviderEvent(event: NormalizedWaffoWebhook): Promise<Row | null> {
    const rows = await this.closeoutSql`
      select id, event_type, linked_order_id, payload_sha256,
        canonical_payload_sha256, normalized_payload
      from payment_webhook_inbox
      where provider = 'waffo'
        and provider_environment = ${event.providerEnvironment}
        and event_id = ${event.eventId}
      limit 1
    ` as Row[];
    return rows[0] ?? null;
  }

  private async persistCrossTypeConflict(
    event: NormalizedWaffoWebhook,
    existing: Row,
  ): Promise<never> {
    await this.closeoutSql.begin(async (transaction) => {
      const lockedRows = await transaction`
        select id, event_type, linked_order_id, payload_sha256,
          canonical_payload_sha256, normalized_payload
        from payment_webhook_inbox
        where provider = 'waffo'
          and provider_environment = ${event.providerEnvironment}
          and event_id = ${event.eventId}
        limit 1 for update
      ` as Row[];
      const locked = lockedRows[0] ?? existing;
      if (String(locked.event_type) === event.eventType) return;

      let incomingOrderId: string | null = null;
      for (const candidate of [event.orderMerchantExternalId, event.internalOrderId]) {
        if (!candidate || !UUID_PATTERN.test(candidate)) continue;
        const orderRows = await transaction`
          select id from payment_orders where id = ${candidate} limit 1
        ` as Row[];
        if (orderRows[0]) {
          incomingOrderId = String(orderRows[0].id);
          break;
        }
      }
      const existingOrderId = locked.linked_order_id == null ? null : String(locked.linked_order_id);
      await transaction`
        insert into payment_webhook_conflicts (
          id, provider, provider_environment, conflict_type, reason_code,
          existing_inbox_id, existing_order_id, incoming_order_id,
          existing_payload_sha256, incoming_payload_sha256,
          existing_canonical_payload_sha256, incoming_canonical_payload_sha256,
          safe_existing_payload, safe_incoming_payload, created_at
        ) values (
          ${randomUUID()}, 'waffo', ${event.providerEnvironment}, 'business',
          'WEBHOOK_BUSINESS_EVENT_CONFLICT', ${String(locked.id)},
          ${existingOrderId}, ${incomingOrderId},
          ${locked.payload_sha256 == null ? null : String(locked.payload_sha256)},
          ${event.payloadSha256},
          ${locked.canonical_payload_sha256 == null ? null : String(locked.canonical_payload_sha256)},
          ${event.canonicalPayloadSha256},
          ${JSON.stringify(locked.normalized_payload ?? null)}::jsonb,
          ${JSON.stringify(event)}::jsonb, clock_timestamp()
        )
      `;
      await transaction`
        insert into payment_financial_reviews (
          id, order_id, inbox_id, reason_code, status, created_at, updated_at
        ) values (
          ${randomUUID()}, ${existingOrderId ?? incomingOrderId}, ${String(locked.id)},
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
            existingEventType: String(locked.event_type),
            incomingEventType: event.eventType,
          })}::jsonb, clock_timestamp()
        )
      `;
    });
    throw new Error("WEBHOOK_BUSINESS_EVENT_CONFLICT");
  }

  override async recordVerifiedEvent(event: NormalizedWaffoWebhook): Promise<{
    inboxId: string;
    duplicate: "delivery" | "event" | null;
  }> {
    const existing = await this.existingProviderEvent(event);
    if (existing && String(existing.event_type) !== event.eventType) {
      return this.persistCrossTypeConflict(event, existing);
    }

    try {
      return await super.recordVerifiedEvent(event);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "WEBHOOK_INBOX_UNAVAILABLE") throw error;
      const raced = await this.existingProviderEvent(event);
      if (!raced) throw error;
      if (String(raced.event_type) !== event.eventType) {
        return this.persistCrossTypeConflict(event, raced);
      }
      // A same-type concurrent insert won the unique eventId race after the
      // base transaction's lookup snapshot. Re-enter once now that the row is visible.
      return super.recordVerifiedEvent(event);
    }
  }
}
