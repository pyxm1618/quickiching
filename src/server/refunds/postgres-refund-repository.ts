import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { RefundWriteResult } from "@/server/payments/provider-authority";
import type { RefundDispatchClaim } from "./refund-command-service";
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

function dispatchClaim(order: Row, refund: Row, mode: RefundDispatchClaim["mode"]): RefundDispatchClaim {
  const providerOrderId = order.provider_order_id == null ? "" : String(order.provider_order_id);
  const providerPaymentId = order.provider_payment_id == null ? "" : String(order.provider_payment_id);
  const providerProductId = order.provider_product_id == null ? "" : String(order.provider_product_id);
  if (!providerOrderId || !providerPaymentId || !providerProductId) {
    throw new Error("REFUND_PAYMENT_IDENTITY_UNAVAILABLE");
  }
  const environment = String(refund.provider_environment);
  if (environment !== "test" && environment !== "prod") throw new Error("REFUND_ENVIRONMENT_INVALID");
  if (String(refund.currency) !== "USD") throw new Error("REFUND_CURRENCY_INVALID");
  return {
    mode,
    refundId: String(refund.id),
    orderId: String(order.id),
    userId: String(refund.user_id),
    environment,
    providerOrderId,
    providerPaymentId,
    providerProductId,
    requestedMinor: Number(refund.requested_minor),
    currency: "USD",
    reason: String(refund.reason),
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
          ${id}, ${screen.eligible ? null : input.now.toISOString()}, ${input.now.toISOString()}, ${input.now.toISOString()}
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
          })}::jsonb, ${input.now.toISOString()}
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
          set status = 'approved', approved_at = ${input.now.toISOString()}, operator_note = ${note},
              updated_at = ${input.now.toISOString()}
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
            ${input.now.toISOString()}
          )
        `;
        return mapRefund(updated[0], false);
      }

      if (status === "rejected") return mapRefund(refund, false);
      if (status !== "manual_review") throw new Error("REFUND_DECISION_CONFLICT");
      const updated = await transaction`
        update refund_intents
        set status = 'rejected', rejected_at = ${input.now.toISOString()}, operator_note = ${note},
            updated_at = ${input.now.toISOString()}
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
          ${input.now.toISOString()}
        )
      `;
      return mapRefund(updated[0], false);
    });
  }

  async claimProviderDispatch(refundId: string, now: Date): Promise<RefundDispatchClaim> {
    if (!Number.isFinite(now.getTime())) throw new Error("REFUND_COMMAND_INVALID");
    const hints = await this.sql`
      select order_id from refund_intents where id = ${refundId} limit 1
    ` as Row[];
    if (!hints[0]) throw new Error("REFUND_INTENT_NOT_FOUND");
    const orderId = String(hints[0].order_id);

    const result = await this.sql.begin(async (transaction) => {
      const orderRows = await transaction`
        select * from payment_orders where id = ${orderId} limit 1 for update
      ` as Row[];
      const order = orderRows[0];
      if (!order) throw new Error("REFUND_ORDER_NOT_FOUND");
      const refundRows = await transaction`
        select * from refund_intents where id = ${refundId} and order_id = ${orderId} limit 1 for update
      ` as Row[];
      const refund = refundRows[0];
      if (!refund) throw new Error("REFUND_INTENT_NOT_FOUND");

      const state = String(refund.provider_write_state);
      const attempts = Number(refund.provider_write_attempt_count);
      if (state !== "not_started" || attempts !== 0 || String(refund.status) !== "approved") {
        return { blocked: false as const, claim: dispatchClaim(order, refund, "read_only") };
      }

      if (
        String(order.status) !== "paid"
        || String(order.user_id) !== String(refund.user_id)
        || String(order.provider_environment) !== String(refund.provider_environment)
        || Number(order.amount_minor) !== Number(refund.requested_minor)
        || String(order.currency) !== "USD"
      ) {
        throw new Error("REFUND_ORDER_STATE_INVALID");
      }

      const batchRows = await transaction`
        select * from entitlement_batches where order_id = ${orderId} limit 1 for update
      ` as Row[];
      const batch = batchRows[0];
      if (!batch) throw new Error("REFUND_ENTITLEMENT_SOURCE_UNAVAILABLE");
      if (
        Number(batch.quantity_available) !== Number(batch.quantity_total)
        || Number(batch.quantity_reserved) !== 0
        || Number(batch.quantity_consumed) !== 0
        || Number(batch.quantity_revoked) !== 0
      ) {
        await transaction`
          update refund_intents
          set status = 'manual_review', auto_screen = 'manual_exception',
              screen_reason = 'REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE',
              last_error_code = 'REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE',
              updated_at = ${now.toISOString()}
          where id = ${refundId} and provider_write_state = 'not_started'
        `;
        await transaction`
          insert into audit_events (
            id, category, action, entity_type, entity_id, user_id, payload, created_at
          ) values (
            ${randomUUID()}, 'reconcile', 'refund_dispatch_blocked', 'refund_intent', ${refundId},
            ${String(refund.user_id)}, ${JSON.stringify({
              reason: "REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE",
              orderId,
            })}::jsonb, ${now.toISOString()}
          )
        `;
        return { blocked: true as const };
      }

      const updated = await transaction`
        update refund_intents
        set provider_write_state = 'dispatched', status = 'processing',
            provider_write_attempt_count = 1, provider_dispatched_at = ${now.toISOString()},
            next_reconcile_at = ${now.toISOString()}, last_error_code = null, updated_at = ${now.toISOString()}
        where id = ${refundId} and status = 'approved'
          and provider_write_state = 'not_started' and provider_write_attempt_count = 0
        returning *
      ` as Row[];
      if (!updated[0]) {
        const latestRows = await transaction`
          select * from refund_intents where id = ${refundId} limit 1
        ` as Row[];
        if (!latestRows[0]) throw new Error("REFUND_INTENT_NOT_FOUND");
        return { blocked: false as const, claim: dispatchClaim(order, latestRows[0], "read_only") };
      }

      await transaction`
        insert into audit_events (
          id, category, action, entity_type, entity_id, user_id, payload, created_at
        ) values (
          ${randomUUID()}, 'reconcile', 'refund_provider_dispatch_fenced', 'refund_intent', ${refundId},
          ${String(refund.user_id)}, ${JSON.stringify({ orderId, providerWriteAttemptCount: 1 })}::jsonb, ${now.toISOString()}
        )
      `;
      return { blocked: false as const, claim: dispatchClaim(order, updated[0], "dispatch") };
    });
    if (result.blocked) throw new Error("REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE");
    return result.claim;
  }

  async markProviderDispatchConfirmed(input: {
    refundId: string;
    result: RefundWriteResult;
    now: Date;
  }): Promise<void> {
    const hints = await this.sql`
      select order_id from refund_intents where id = ${input.refundId} limit 1
    ` as Row[];
    if (!hints[0]) throw new Error("REFUND_INTENT_NOT_FOUND");
    const orderId = String(hints[0].order_id);

    await this.sql.begin(async (transaction) => {
      await transaction`select id from payment_orders where id = ${orderId} limit 1 for update`;
      const rows = await transaction`
        select * from refund_intents where id = ${input.refundId} limit 1 for update
      ` as Row[];
      const refund = rows[0];
      if (!refund) throw new Error("REFUND_INTENT_NOT_FOUND");
      if (String(refund.provider_write_state) === "confirmed") {
        if (String(refund.provider_ticket_id ?? "") === input.result.providerTicketId) return;
        throw new Error("REFUND_PROVIDER_REFERENCE_CONFLICT");
      }
      if (String(refund.provider_write_state) !== "dispatched" || Number(refund.provider_write_attempt_count) !== 1) {
        throw new Error("REFUND_PROVIDER_WRITE_STATE_CONFLICT");
      }

      const failed = input.result.status === "failed";
      const updated = await transaction`
        update refund_intents
        set provider_write_state = 'confirmed', provider_ticket_id = ${input.result.providerTicketId},
            status = ${failed ? "failed" : "processing"},
            next_reconcile_at = ${failed ? null : input.now.toISOString()},
            last_error_code = ${failed ? "REFUND_PROVIDER_REJECTED" : null},
            updated_at = ${input.now.toISOString()}
        where id = ${input.refundId} and provider_write_state = 'dispatched'
          and provider_write_attempt_count = 1
        returning id
      ` as Row[];
      if (!updated[0]) throw new Error("REFUND_PROVIDER_WRITE_STATE_CONFLICT");
      await transaction`
        insert into audit_events (
          id, category, action, entity_type, entity_id, user_id, payload, created_at
        ) values (
          ${randomUUID()}, 'reconcile', 'refund_provider_dispatch_confirmed', 'refund_intent',
          ${input.refundId}, ${String(refund.user_id)}, ${JSON.stringify({
            orderId,
            providerTicketId: input.result.providerTicketId,
            providerStatus: input.result.status,
          })}::jsonb, ${input.now.toISOString()}
        )
      `;
    });
  }

  async markProviderDispatchAmbiguous(input: {
    refundId: string;
    errorCode: string;
    now: Date;
  }): Promise<void> {
    const hints = await this.sql`
      select order_id from refund_intents where id = ${input.refundId} limit 1
    ` as Row[];
    if (!hints[0]) throw new Error("REFUND_INTENT_NOT_FOUND");
    const orderId = String(hints[0].order_id);

    await this.sql.begin(async (transaction) => {
      await transaction`select id from payment_orders where id = ${orderId} limit 1 for update`;
      const rows = await transaction`
        select * from refund_intents where id = ${input.refundId} limit 1 for update
      ` as Row[];
      const refund = rows[0];
      if (!refund) throw new Error("REFUND_INTENT_NOT_FOUND");
      const state = String(refund.provider_write_state);
      if (state === "confirmed" || String(refund.status) === "succeeded" || String(refund.status) === "failed") return;
      if (state === "ambiguous") return;
      if (state !== "dispatched" || Number(refund.provider_write_attempt_count) !== 1) {
        throw new Error("REFUND_PROVIDER_WRITE_STATE_CONFLICT");
      }

      await transaction`
        update refund_intents
        set provider_write_state = 'ambiguous', status = 'reconciliation_required',
            next_reconcile_at = ${input.now.toISOString()}, last_error_code = ${input.errorCode},
            updated_at = ${input.now.toISOString()}
        where id = ${input.refundId} and provider_write_state = 'dispatched'
          and provider_write_attempt_count = 1
      `;
      await transaction`
        insert into audit_events (
          id, category, action, entity_type, entity_id, user_id, payload, created_at
        ) values (
          ${randomUUID()}, 'reconcile', 'refund_provider_dispatch_ambiguous', 'refund_intent',
          ${input.refundId}, ${String(refund.user_id)}, ${JSON.stringify({ orderId, errorCode: input.errorCode })}::jsonb,
          ${input.now.toISOString()}
        )
      `;
    });
  }
}
