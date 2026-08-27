import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { PostgresPaymentRepository } from "./postgres-repository";

export type ClaimedOutboxItem = {
  id: string;
  inboxId: string;
  orderId: string | null;
  topic: string;
  leaseToken: string;
  attemptCount: number;
};

export type DispatchResult = {
  outboxId: string;
  inboxId: string;
  outcome: string;
  reason?: string;
  deadLetter?: boolean;
};

export interface OutboxDispatcher {
  claimBatch(options?: { limit?: number; leaseDurationMs?: number }): Promise<ClaimedOutboxItem[]>;
  dispatchItem(item: ClaimedOutboxItem): Promise<DispatchResult>;
  dispatchAllPending(options?: { batchSize?: number; maxBatches?: number }): Promise<{
    processedCount: number;
    results: DispatchResult[];
  }>;
}

const DEFAULT_LEASE_MS = 30 * 1000;
const MAX_ATTEMPTS = 3;

function calculateBackoffMs(attemptCount: number): number {
  const baseMs = 1000;
  const maxMs = 10 * 60 * 1000; // 10 minutes
  const backoff = baseMs * Math.pow(2, Math.min(attemptCount, 10));
  return Math.min(backoff, maxMs);
}

export function createOutboxDispatcher(dependencies: {
  sql: Sql;
  repository: PostgresPaymentRepository;
}): OutboxDispatcher {
  const { sql, repository } = dependencies;

  return {
    async claimBatch(options = {}) {
      const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
      const leaseDurationMs = Math.max(5000, Math.min(options.leaseDurationMs ?? DEFAULT_LEASE_MS, 5 * 60 * 1000));

      return sql.begin(async (transaction) => {
        const rows = await transaction`
          select id, inbox_id, order_id, topic, attempt_count, status
          from payment_outbox
          where (
            (status in ('pending', 'failed') and available_at <= clock_timestamp())
            or (status = 'processing' and lease_expires_at <= clock_timestamp())
          )
          order by available_at asc
          limit ${limit}
          for update skip locked
        ` as Array<{
          id: string;
          inbox_id: string;
          order_id: string | null;
          topic: string;
          attempt_count: number;
          status: string;
        }>;

        if (rows.length === 0) return [];

        const claimed: ClaimedOutboxItem[] = [];

        for (const row of rows) {
          const currentAttempts = Number(row.attempt_count);

          // If crashed or failed and already hit max attempts, route to dead letter
          if (currentAttempts >= MAX_ATTEMPTS) {
            await transaction`
              update payment_outbox
              set status = 'dead_letter',
                  lease_token = null,
                  lease_expires_at = null,
                  last_error_code = coalesce(last_error_code, 'MAX_ATTEMPTS_EXCEEDED'),
                  updated_at = clock_timestamp()
              where id = ${row.id}
            `;
            await transaction`
              update payment_webhook_inbox
              set status = 'dead_letter',
                  last_error_code = coalesce(last_error_code, 'MAX_ATTEMPTS_EXCEEDED'),
                  updated_at = clock_timestamp()
              where id = ${row.inbox_id}
            `;
            continue;
          }

          const leaseToken = randomUUID();
          const nextAttempt = currentAttempts + 1;

          await transaction`
            update payment_outbox
            set status = 'processing',
                lease_token = ${leaseToken},
                lease_expires_at = clock_timestamp() + (${leaseDurationMs} * interval '1 millisecond'),
                attempt_count = ${nextAttempt},
                updated_at = clock_timestamp()
            where id = ${row.id}
          `;

          await transaction`
            update payment_webhook_inbox
            set status = 'processing',
                attempt_count = greatest(attempt_count, ${nextAttempt}),
                updated_at = clock_timestamp()
            where id = ${row.inbox_id} and status in ('received', 'failed', 'processing', 'pending_order')
          `;

          claimed.push({
            id: String(row.id),
            inboxId: String(row.inbox_id),
            orderId: row.order_id ? String(row.order_id) : null,
            topic: String(row.topic),
            leaseToken,
            attemptCount: nextAttempt,
          });
        }

        return claimed;
      });
    },

    async dispatchItem(item: ClaimedOutboxItem): Promise<DispatchResult> {
      try {
        const outcome = await repository.processInbox(item.inboxId, { leaseToken: item.leaseToken });
        return {
          outboxId: item.id,
          inboxId: item.inboxId,
          outcome: outcome.outcome,
          reason: outcome.reason,
        };
      } catch (error) {
        const errorCode = error instanceof Error ? error.message : "DISPATCH_FAILED";
        const failure = await repository.recordProcessingFailure(item.inboxId, {
          leaseToken: item.leaseToken,
          errorCode,
        });

        if (!failure.deadLetter) {
          const backoffMs = calculateBackoffMs(failure.attemptCount);
          await sql`
            update payment_outbox
            set available_at = clock_timestamp() + (${backoffMs} * interval '1 millisecond'),
                updated_at = clock_timestamp()
            where id = ${item.id} and lease_token is null
          `;
        }

        return {
          outboxId: item.id,
          inboxId: item.inboxId,
          outcome: failure.deadLetter ? "dead_letter" : "failed",
          reason: errorCode,
          deadLetter: failure.deadLetter,
        };
      }
    },

    async dispatchAllPending(options = {}) {
      const batchSize = options.batchSize ?? 20;
      const maxBatches = options.maxBatches ?? 5;
      const allResults: DispatchResult[] = [];
      let totalProcessed = 0;

      for (let b = 0; b < maxBatches; b++) {
        const items = await this.claimBatch({ limit: batchSize });
        if (items.length === 0) break;

        for (const item of items) {
          const res = await this.dispatchItem(item);
          allResults.push(res);
          totalProcessed++;
        }
      }

      return {
        processedCount: totalProcessed,
        results: allResults,
      };
    },
  };
}
