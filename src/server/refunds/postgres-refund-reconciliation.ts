import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { RefundReconciliationCandidate, RefundReconciliationRepository } from "./refund-reconciliation-service";

const DEFAULT_LEASE_MS = 30_000;
const DEFAULT_LIMIT = 20;
export const REFUND_RECONCILE_MAX_ATTEMPTS = 5;

type Row = Record<string, unknown>;

function eligible(row: Row, now: Date): boolean {
  const status = String(row.status);
  const writeState = String(row.provider_write_state);
  const due = row.next_reconcile_at == null || new Date(String(row.next_reconcile_at)).getTime() <= now.getTime();
  const leaseExpired = row.reconcile_lease_expires_at == null
    || new Date(String(row.reconcile_lease_expires_at)).getTime() <= now.getTime();
  return (status === "processing" || status === "reconciliation_required")
    && (writeState === "dispatched" || writeState === "confirmed" || writeState === "ambiguous")
    && Number(row.provider_write_attempt_count) === 1
    && due
    && leaseExpired;
}

function candidate(order: Row, refund: Row): RefundReconciliationCandidate {
  const environment = String(refund.provider_environment);
  if (environment !== "test" && environment !== "prod") throw new Error("REFUND_ENVIRONMENT_INVALID");
  if (String(order.currency) !== "USD" || String(refund.currency) !== "USD") {
    throw new Error("REFUND_CURRENCY_INVALID");
  }
  const providerOrderId = String(order.provider_order_id ?? "");
  const providerPaymentId = String(order.provider_payment_id ?? "");
  const providerProductId = String(order.provider_product_id ?? "");
  if (!providerOrderId || !providerPaymentId || !providerProductId) {
    throw new Error("REFUND_PAYMENT_IDENTITY_UNAVAILABLE");
  }
  const leaseToken = String(refund.reconcile_lease_token ?? "");
  if (!leaseToken) throw new Error("REFUND_RECONCILE_LEASE_UNAVAILABLE");
  return {
    refundId: String(refund.id),
    orderId: String(order.id),
    userId: String(refund.user_id),
    environment,
    providerOrderId,
    providerPaymentId,
    providerProductId,
    requestedMinor: Number(refund.requested_minor),
    paymentAmountMinor: Number(order.amount_minor),
    currency: "USD",
    providerTicketId: refund.provider_ticket_id == null ? null : String(refund.provider_ticket_id),
    leaseToken,
    reconcileAttemptCount: Number(refund.reconcile_attempt_count),
  };
}

function backoffMs(attempt: number): number {
  return Math.min(5_000 * Math.pow(2, Math.max(0, attempt - 1)), 15 * 60_000);
}

export class PostgresRefundReconciliationRepository implements RefundReconciliationRepository {
  constructor(private readonly sql: Sql) {}

  async claimBatch(options: { limit?: number; leaseDurationMs?: number; now?: Date } = {}): Promise<RefundReconciliationCandidate[]> {
    const now = options.now ?? new Date();
    if (!Number.isFinite(now.getTime())) throw new Error("REFUND_RECONCILE_INVALID");
    const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_LIMIT, 100));
    const leaseDurationMs = Math.max(5_000, Math.min(options.leaseDurationMs ?? DEFAULT_LEASE_MS, 5 * 60_000));

    const hints = await this.sql<Array<{ id: string; order_id: string }>>`
      select id, order_id
      from refund_intents
      where status in ('processing', 'reconciliation_required')
        and provider_write_state in ('dispatched', 'confirmed', 'ambiguous')
        and provider_write_attempt_count = 1
        and (next_reconcile_at is null or next_reconcile_at <= ${now.toISOString()})
        and (reconcile_lease_expires_at is null or reconcile_lease_expires_at <= ${now.toISOString()})
      order by coalesce(next_reconcile_at, created_at) asc, created_at asc, id asc
      limit ${limit * 3}
    `;

    const claimed: RefundReconciliationCandidate[] = [];
    for (const hint of hints) {
      if (claimed.length >= limit) break;
      const result = await this.sql.begin(async (transaction) => {
        const orderRows = await transaction`
          select * from payment_orders where id = ${hint.order_id} limit 1 for update
        ` as Row[];
        const order = orderRows[0];
        if (!order) return null;

        const refundRows = await transaction`
          select * from refund_intents where id = ${hint.id} and order_id = ${hint.order_id}
          limit 1 for update
        ` as Row[];
        const refund = refundRows[0];
        if (!refund || !eligible(refund, now)) return null;

        const attempts = Number(refund.reconcile_attempt_count);
        if (attempts >= REFUND_RECONCILE_MAX_ATTEMPTS) {
          await transaction`
            update payment_orders
            set status = case when status = 'refunded' then status else 'financial_review' end,
                updated_at = ${now.toISOString()}
            where id = ${hint.order_id}
          `;
          await transaction`
            update refund_intents
            set status = 'reconciliation_required',
                next_reconcile_at = null,
                reconcile_lease_token = null,
                reconcile_lease_expires_at = null,
                last_error_code = 'REFUND_RECONCILE_MAX_ATTEMPTS',
                updated_at = ${now.toISOString()}
            where id = ${hint.id}
          `;
          await transaction`
            insert into audit_events (
              id, category, action, entity_type, entity_id, user_id, payload, created_at
            ) values (
              ${randomUUID()}, 'reconcile', 'refund_reconcile_attempt_cap', 'refund_intent',
              ${hint.id}, ${String(refund.user_id)}, ${JSON.stringify({
                orderId: hint.order_id,
                reconcileAttemptCount: attempts,
              })}::jsonb, ${now.toISOString()}
            )
          `;
          return null;
        }

        const leaseToken = randomUUID();
        const nextAttempt = attempts + 1;
        const updated = await transaction`
          update refund_intents
          set reconcile_attempt_count = ${nextAttempt},
              reconcile_lease_token = ${leaseToken},
              reconcile_lease_expires_at = ${new Date(now.getTime() + leaseDurationMs).toISOString()},
              updated_at = ${now.toISOString()}
          where id = ${hint.id}
            and reconcile_attempt_count = ${attempts}
            and (reconcile_lease_expires_at is null or reconcile_lease_expires_at <= ${now.toISOString()})
          returning *
        ` as Row[];
        if (!updated[0]) return null;
        return candidate(order, updated[0]);
      });
      if (result) claimed.push(result);
    }
    return claimed;
  }

  async reschedule(input: {
    refundId: string;
    leaseToken: string;
    providerTicketId?: string | null;
    errorCode: string;
    now: Date;
  }): Promise<void> {
    const hints = await this.sql<Array<{ order_id: string }>>`
      select order_id from refund_intents where id = ${input.refundId} limit 1
    `;
    if (!hints[0]) return;
    await this.sql.begin(async (transaction) => {
      await transaction`select id from payment_orders where id = ${hints[0]!.order_id} limit 1 for update`;
      const rows = await transaction`
        select * from refund_intents where id = ${input.refundId} limit 1 for update
      ` as Row[];
      const refund = rows[0];
      if (!refund) return;
      if (String(refund.status) === "succeeded" || String(refund.status) === "failed") return;
      if (String(refund.reconcile_lease_token ?? "") !== input.leaseToken) return;

      const currentTicket = refund.provider_ticket_id == null ? null : String(refund.provider_ticket_id);
      if (input.providerTicketId && currentTicket && currentTicket !== input.providerTicketId) {
        await transaction`
          update payment_orders
          set status = case when status = 'refunded' then status else 'financial_review' end,
              updated_at = ${input.now.toISOString()}
          where id = ${hints[0]!.order_id}
        `;
        await transaction`
          update refund_intents
          set status = 'reconciliation_required', next_reconcile_at = null,
              reconcile_lease_token = null, reconcile_lease_expires_at = null,
              last_error_code = 'REFUND_PROVIDER_REFERENCE_CONFLICT', updated_at = ${input.now.toISOString()}
          where id = ${input.refundId}
        `;
        return;
      }

      const attempts = Number(refund.reconcile_attempt_count);
      await transaction`
        update refund_intents
        set provider_ticket_id = ${input.providerTicketId ?? currentTicket},
            next_reconcile_at = ${new Date(input.now.getTime() + backoffMs(attempts)).toISOString()},
            reconcile_lease_token = null,
            reconcile_lease_expires_at = null,
            last_error_code = ${input.errorCode},
            updated_at = ${input.now.toISOString()}
        where id = ${input.refundId} and reconcile_lease_token = ${input.leaseToken}
      `;
    });
  }

  async markManualReview(input: {
    refundId: string;
    leaseToken: string;
    errorCode: string;
    now: Date;
  }): Promise<void> {
    const hints = await this.sql<Array<{ order_id: string }>>`
      select order_id from refund_intents where id = ${input.refundId} limit 1
    `;
    if (!hints[0]) return;
    await this.sql.begin(async (transaction) => {
      await transaction`select id from payment_orders where id = ${hints[0]!.order_id} limit 1 for update`;
      const rows = await transaction`
        select * from refund_intents where id = ${input.refundId} limit 1 for update
      ` as Row[];
      const refund = rows[0];
      if (!refund) return;
      if (String(refund.status) === "succeeded" || String(refund.status) === "failed") return;
      if (String(refund.reconcile_lease_token ?? "") !== input.leaseToken) return;

      await transaction`
        update payment_orders
        set status = case when status = 'refunded' then status else 'financial_review' end,
            updated_at = ${input.now.toISOString()}
        where id = ${hints[0]!.order_id}
      `;
      await transaction`
        update refund_intents
        set status = 'reconciliation_required', next_reconcile_at = null,
            reconcile_lease_token = null, reconcile_lease_expires_at = null,
            last_error_code = ${input.errorCode}, updated_at = ${input.now.toISOString()}
        where id = ${input.refundId} and reconcile_lease_token = ${input.leaseToken}
      `;
      await transaction`
        insert into audit_events (
          id, category, action, entity_type, entity_id, user_id, payload, created_at
        ) values (
          ${randomUUID()}, 'reconcile', 'refund_reconcile_manual_review', 'refund_intent',
          ${input.refundId}, ${String(refund.user_id)}, ${JSON.stringify({
            orderId: hints[0]!.order_id,
            errorCode: input.errorCode,
          })}::jsonb, ${input.now.toISOString()}
        )
      `;
    });
  }
}
