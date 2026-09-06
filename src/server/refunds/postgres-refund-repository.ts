import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { screenRefundApplication } from "./refund-policy";

type Row = Record<string, unknown>;

export type RefundIntentRecord = {
  id: string;
  orderId: string;
  userId: string;
  requestedMinor: number;
  currency: "USD";
  autoScreen: "clear" | "manual_exception" | "rejected";
  screenReason: string | null;
  status: string;
  providerWriteState: string;
  providerWriteAttemptCount: number;
  created: boolean;
};

function mapRefund(row: Row, created: boolean): RefundIntentRecord {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    userId: String(row.user_id),
    requestedMinor: Number(row.requested_minor),
    currency: "USD",
    autoScreen: String(row.auto_screen) as RefundIntentRecord["autoScreen"],
    screenReason: row.screen_reason == null ? null : String(row.screen_reason),
    status: String(row.status),
    providerWriteState: String(row.provider_write_state),
    providerWriteAttemptCount: Number(row.provider_write_attempt_count),
    created,
  };
}

export class PostgresRefundRepository {
  constructor(private readonly sql: Sql) {}

  async apply(input: {
    userId: string;
    orderId: string;
    reason: string;
    now: Date;
  }): Promise<RefundIntentRecord> {
    const reason = input.reason.trim();
    if (!reason || reason.length > 1000) throw new Error("REFUND_REQUEST_INVALID");
    if (!Number.isFinite(input.now.getTime())) throw new Error("REFUND_REQUEST_INVALID");

    return this.sql.begin(async (transaction) => {
      const orders = await transaction`
        select * from payment_orders where id = ${input.orderId} limit 1 for update
      ` as Row[];
      const order = orders[0];
      if (!order || String(order.user_id) !== input.userId) throw new Error("REFUND_ORDER_NOT_FOUND");

      const existingRows = await transaction`
        select * from refund_intents where order_id = ${input.orderId} limit 1 for update
      ` as Row[];
      if (existingRows[0]) return mapRefund(existingRows[0], false);

      const batches = await transaction`
        select * from entitlement_batches where order_id = ${input.orderId} limit 1 for update
      ` as Row[];
      const batch = batches[0];
      if (!batch) throw new Error("REFUND_ENTITLEMENT_SOURCE_UNAVAILABLE");

      const paidAt = order.paid_at instanceof Date ? order.paid_at : new Date(String(order.paid_at ?? ""));
      const screen = screenRefundApplication({
        paidAt,
        now: input.now,
        orderStatus: String(order.status),
        quantityTotal: Number(batch.quantity_total),
        quantityAvailable: Number(batch.quantity_available),
        quantityReserved: Number(batch.quantity_reserved),
        quantityConsumed: Number(batch.quantity_consumed),
        quantityRevoked: Number(batch.quantity_revoked),
      });
      const id = randomUUID();
      const status = screen.eligible ? "manual_review" : "rejected";
      const inserted = await transaction`
        insert into refund_intents (
          id, order_id, user_id, provider_environment, requested_minor, currency,
          reason, auto_screen, screen_reason, status, provider_write_state,
          provider_write_attempt_count, refund_ticket_merchant_external_id,
          rejected_at, created_at, updated_at
        ) values (
          ${id}, ${input.orderId}, ${input.userId}, ${String(order.provider_environment)},
          ${Number(order.amount_minor)}, ${String(order.currency)}, ${reason},
          ${screen.autoScreen}, ${screen.reasonCode}, ${status}, 'not_started', 0,
          ${id}, ${screen.eligible ? null : input.now}, ${input.now}, ${input.now}
        ) returning *
      ` as Row[];
      if (!inserted[0]) throw new Error("REFUND_INTENT_UNAVAILABLE");

      await transaction`
        insert into audit_events (
          id, category, action, entity_type, entity_id, user_id, payload, created_at
        ) values (
          ${randomUUID()}, 'reconcile', 'refund_application_submitted', 'refund_intent',
          ${id}, ${input.userId}, ${JSON.stringify({
            source: "user",
            orderId: input.orderId,
            autoScreen: screen.autoScreen,
            screenReason: screen.reasonCode,
            requestedMinor: Number(order.amount_minor),
            currency: String(order.currency),
          })}::jsonb, ${input.now}
        )
      `;
      return mapRefund(inserted[0], true);
    });
  }

  async decide(input: {
    refundId: string;
    action: "approve" | "reject";
    operatorId: string;
    note?: string;
    now: Date;
  }): Promise<RefundIntentRecord> {
    const note = input.note?.trim() || null;
    if (note && note.length > 1000) throw new Error("REFUND_DECISION_INVALID");
    const hints = await this.sql`
      select order_id from refund_intents where id = ${input.refundId} limit 1
    ` as Row[];
    if (!hints[0]) throw new Error("REFUND_INTENT_NOT_FOUND");
    const orderId = String(hints[0].order_id);

    return this.sql.begin(async (transaction) => {
      const orders = await transaction`
        select id from payment_orders where id = ${orderId} limit 1 for update
      ` as Row[];
      if (!orders[0]) throw new Error("REFUND_ORDER_NOT_FOUND");
      const rows = await transaction`
        select * from refund_intents where id = ${input.refundId} limit 1 for update
      ` as Row[];
      const refund = rows[0];
      if (!refund || String(refund.order_id) !== orderId) throw new Error("REFUND_INTENT_NOT_FOUND");

      const status = String(refund.status);
      if (input.action === "approve") {
        if (status === "approved" || status === "processing" || status === "reconciliation_required" || status === "succeeded") {
          if (refund.approved_at != null) return mapRefund(refund, false);
          throw new Error("REFUND_DECISION_CONFLICT");
        }
        if (status !== "manual_review") throw new Error("REFUND_DECISION_CONFLICT");
        if (String(refund.auto_screen) !== "clear") {
          throw new Error("REFUND_MANUAL_EXCEPTION_REQUIRES_POLICY_DECISION");
        }
        const updated = await transaction`
          update refund_intents
          set status = 'approved', approved_at = ${input.now}, operator_note = ${note},
              updated_at = ${input.now}
          where id = ${input.refundId} and status = 'manual_review'
          returning *
        ` as Row[];
        if (!updated[0]) throw new Error("REFUND_DECISION_CONFLICT");
        await transaction`
          insert into audit_events (
            id, category, action, entity_type, entity_id, payload, created_at
          ) values (
            ${randomUUID()}, 'reconcile', 'refund_operator_approved', 'refund_intent',
            ${input.refundId}, ${JSON.stringify({ source: "operator", operatorId: input.operatorId, note })}::jsonb,
            ${input.now}
          )
        `;
        return mapRefund(updated[0], false);
      }

      if (status === "rejected") return mapRefund(refund, false);
      if (status !== "manual_review") throw new Error("REFUND_DECISION_CONFLICT");
      const updated = await transaction`
        update refund_intents
        set status = 'rejected', rejected_at = ${input.now}, operator_note = ${note},
            updated_at = ${input.now}
        where id = ${input.refundId} and status = 'manual_review'
        returning *
      ` as Row[];
      if (!updated[0]) throw new Error("REFUND_DECISION_CONFLICT");
      await transaction`
        insert into audit_events (
          id, category, action, entity_type, entity_id, payload, created_at
        ) values (
          ${randomUUID()}, 'reconcile', 'refund_operator_rejected', 'refund_intent',
          ${input.refundId}, ${JSON.stringify({ source: "operator", operatorId: input.operatorId, note })}::jsonb,
          ${input.now}
        )
      `;
      return mapRefund(updated[0], false);
    });
  }
}
