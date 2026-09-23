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
  dispatchAllPending(options?: { batchSize?: number; maxBatches?: number; deadlineAt?: number }): Promise<{
    processedCount: number;
    results: DispatchResult[];
  }>;
}

const DEFAULT_LEASE_MS = 30 * 1000;
const MAX_ATTEMPTS = 3;

function calculateBackoffMs(attemptCount: number): number {
  const baseMs = 1000;
  const maxMs = 10 * 60 * 1000;
  return Math.min(baseMs * Math.pow(2, Math.min(attemptCount, 10)), maxMs);
}

function safeFailureCode(value: string): string {
  const candidate = value.trim();
  return /^[A-Z][A-Z0-9_]{0,63}$/.test(candidate) ? candidate : "PAYMENT_PROCESSING_FAILURE";
}

async function recordLeasedProcessingFailure(
  sql: Sql,
  item: ClaimedOutboxItem,
  errorCode: string,
): Promise<{ deadLetter: boolean; attemptCount: number; leaseLost: boolean }> {
  return sql.begin(async (transaction) => {
    const rows = await transaction`
      select i.status as inbox_status, o.status as outbox_status,
        o.lease_token as outbox_lease_token,
        greatest(i.attempt_count, o.attempt_count) as attempt_count
      from payment_webhook_inbox i
      join payment_outbox o on o.inbox_id = i.id
      where i.id = ${item.inboxId} and o.id = ${item.id}
      limit 1 for update of i, o
    ` as Array<{
      inbox_status: string;
      outbox_status: string;
      outbox_lease_token: string | null;
      attempt_count: number;
    }>;
    const row = rows[0];
    if (!row) throw new Error("PAYMENT_OUTBOX_UNAVAILABLE");

    const attemptCount = Number(row.attempt_count);
    // Exact equality is required even when the persisted token is NULL. A
    // stale worker must never be able to fail a row after ownership changed.
    if (row.outbox_status !== "processing" || row.outbox_lease_token !== item.leaseToken) {
      return { deadLetter: row.outbox_status === "dead_letter", attemptCount, leaseLost: true };
    }

    const deadLetter = attemptCount >= MAX_ATTEMPTS;
    const code = safeFailureCode(errorCode);
    const updatedOutbox = await transaction`
      update payment_outbox
      set status = ${deadLetter ? "dead_letter" : "failed"},
          attempt_count = ${attemptCount}, last_error_code = ${code},
          lease_token = null, lease_expires_at = null, completed_at = null,
          updated_at = clock_timestamp()
      where id = ${item.id} and status = 'processing' and lease_token = ${item.leaseToken}
      returning id
    ` as Array<{ id: string }>;
    if (!updatedOutbox[0]) {
      return { deadLetter: false, attemptCount, leaseLost: true };
    }

    await transaction`
      update payment_webhook_inbox
      set status = ${deadLetter ? "dead_letter" : "failed"},
          attempt_count = greatest(attempt_count, ${attemptCount}),
          last_error_code = ${code}, processed_at = null, updated_at = clock_timestamp()
      where id = ${item.inboxId} and status = 'processing'
    `;
    return { deadLetter, attemptCount, leaseLost: false };
  });
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
          if (currentAttempts >= MAX_ATTEMPTS) {
            await transaction`
              update payment_outbox
              set status = 'dead_letter', lease_token = null, lease_expires_at = null,
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
            set status = 'processing', lease_token = ${leaseToken},
                lease_expires_at = clock_timestamp() + (${leaseDurationMs} * interval '1 millisecond'),
                attempt_count = ${nextAttempt}, updated_at = clock_timestamp()
            where id = ${row.id}
          `;
          await transaction`
            update payment_webhook_inbox
            set status = 'processing', attempt_count = greatest(attempt_count, ${nextAttempt}),
                updated_at = clock_timestamp()
            where id = ${row.inbox_id} and status in ('received', 'failed', 'processing', 'pending_order')
          `;
          claimed.push({
            id: String(row.id), inboxId: String(row.inbox_id),
            orderId: row.order_id ? String(row.order_id) : null,
            topic: String(row.topic), leaseToken, attemptCount: nextAttempt,
          });
        }
        return claimed;
      });
    },

    async dispatchItem(item: ClaimedOutboxItem): Promise<DispatchResult> {
      try {
        const outcome = await repository.processInbox(item.inboxId, { leaseToken: item.leaseToken });
        return {
          outboxId: item.id, inboxId: item.inboxId,
          outcome: outcome.outcome, reason: outcome.reason,
        };
      } catch (error) {
        const errorCode = error instanceof Error ? error.message : "DISPATCH_FAILED";
        const failure = await recordLeasedProcessingFailure(sql, item, errorCode);
        if (failure.leaseLost) {
          return {
            outboxId: item.id, inboxId: item.inboxId,
            outcome: "lease_lost", reason: "PAYMENT_WEBHOOK_LEASE_LOST",
          };
        }

        if (!failure.deadLetter) {
          const backoffMs = calculateBackoffMs(failure.attemptCount);
          await sql`
            update payment_outbox
            set available_at = clock_timestamp() + (${backoffMs} * interval '1 millisecond'),
                updated_at = clock_timestamp()
            where id = ${item.id} and status = 'failed' and lease_token is null
          `;
        }

        return {
          outboxId: item.id, inboxId: item.inboxId,
          outcome: failure.deadLetter ? "dead_letter" : "failed",
          reason: safeFailureCode(errorCode), deadLetter: failure.deadLetter,
        };
      }
    },

    async dispatchAllPending(options = {}) {
      const batchSize = options.batchSize ?? 20;
      const maxBatches = options.maxBatches ?? 5;
      const deadlineAt = options.deadlineAt;
      const deadlineReached = () => deadlineAt !== undefined && Date.now() >= deadlineAt;
      const allResults: DispatchResult[] = [];
      let totalProcessed = 0;

      for (let b = 0; b < maxBatches; b++) {
        if (deadlineReached()) break;
        const items = await this.claimBatch({ limit: batchSize });
        if (items.length === 0) break;
        for (const item of items) {
          if (deadlineReached()) break;
          allResults.push(await this.dispatchItem(item));
          totalProcessed++;
        }
        if (deadlineReached()) break;
      }
      return { processedCount: totalProcessed, results: allResults };
    },
  };
}
