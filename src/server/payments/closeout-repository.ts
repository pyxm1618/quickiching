import { randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import { canonicalWaffoPayloadHash, type NormalizedWaffoWebhook } from "./waffo-webhook";
import { PostgresPaymentRepository } from "./postgres-repository";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;

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
}
