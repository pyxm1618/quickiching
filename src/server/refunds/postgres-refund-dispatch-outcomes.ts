import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";

type Row = Record<string, unknown>;

export class PostgresRefundDispatchOutcomeRepository {
  constructor(private readonly sql: Sql) {}

  async releaseProviderDispatchNotSent(input: {
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
        select * from refund_intents where id = ${input.refundId} and order_id = ${orderId} limit 1 for update
      ` as Row[];
      const refund = rows[0];
      if (!refund) throw new Error("REFUND_INTENT_NOT_FOUND");

      if (
        String(refund.provider_write_state) !== "dispatched"
        || Number(refund.provider_write_attempt_count) !== 1
        || String(refund.status) !== "processing"
      ) {
        throw new Error("REFUND_PROVIDER_WRITE_STATE_CONFLICT");
      }

      const updated = await transaction`
        update refund_intents
        set provider_write_state = 'not_started', provider_write_attempt_count = 0,
            status = 'approved', provider_dispatched_at = null, next_reconcile_at = null,
            last_error_code = ${input.errorCode}, updated_at = ${input.now.toISOString()}
        where id = ${input.refundId}
          and provider_write_state = 'dispatched'
          and provider_write_attempt_count = 1
          and status = 'processing'
        returning id
      ` as Row[];
      if (!updated[0]) throw new Error("REFUND_PROVIDER_WRITE_STATE_CONFLICT");

      await transaction`
        insert into audit_events (
          id, category, action, entity_type, entity_id, user_id, payload, created_at
        ) values (
          ${randomUUID()}, 'reconcile', 'refund_provider_write_not_dispatched', 'refund_intent',
          ${input.refundId}, ${String(refund.user_id)}, ${JSON.stringify({
            source: "operator",
            orderId,
            errorCode: input.errorCode,
            providerWriteAttemptCount: 0,
          })}::jsonb, ${input.now.toISOString()}
        )
      `;
    });
  }

  async markProviderDispatchRejected(input: {
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
        select * from refund_intents where id = ${input.refundId} and order_id = ${orderId} limit 1 for update
      ` as Row[];
      const refund = rows[0];
      if (!refund) throw new Error("REFUND_INTENT_NOT_FOUND");

      if (String(refund.status) === "failed" && String(refund.provider_write_state) === "confirmed") return;
      if (
        String(refund.provider_write_state) !== "dispatched"
        || Number(refund.provider_write_attempt_count) !== 1
        || String(refund.status) !== "processing"
      ) {
        throw new Error("REFUND_PROVIDER_WRITE_STATE_CONFLICT");
      }

      const updated = await transaction`
        update refund_intents
        set provider_write_state = 'confirmed', status = 'failed', next_reconcile_at = null,
            last_error_code = ${input.errorCode}, updated_at = ${input.now.toISOString()}
        where id = ${input.refundId}
          and provider_write_state = 'dispatched'
          and provider_write_attempt_count = 1
          and status = 'processing'
        returning id
      ` as Row[];
      if (!updated[0]) throw new Error("REFUND_PROVIDER_WRITE_STATE_CONFLICT");

      await transaction`
        insert into audit_events (
          id, category, action, entity_type, entity_id, user_id, payload, created_at
        ) values (
          ${randomUUID()}, 'reconcile', 'refund_provider_write_rejected', 'refund_intent',
          ${input.refundId}, ${String(refund.user_id)}, ${JSON.stringify({
            source: "provider",
            orderId,
            errorCode: input.errorCode,
            providerWriteAttemptCount: 1,
          })}::jsonb, ${input.now.toISOString()}
        )
      `;
    });
  }
}
