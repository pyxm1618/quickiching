import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { OutboxDispatcher } from "@/server/payments/outbox-dispatcher";

export type ReconcileMetrics = {
  outboxProcessed: number;
  checkoutCleaned: number;
  jobsTimedOut: number;
  reservationsReleased: number;
  workflowRunsRecovered: number;
  durationMs: number;
};

export interface ReconcileService {
  runReconcile(options?: { budgetMs?: number }): Promise<ReconcileMetrics>;
}

export function createReconcileService(dependencies: {
  sql: Sql;
  outboxDispatcher: OutboxDispatcher;
}): ReconcileService {
  const { sql, outboxDispatcher } = dependencies;

  return {
    async runReconcile(options = {}): Promise<ReconcileMetrics> {
      const startTime = Date.now();
      const budgetMs = options.budgetMs ?? 10_000;

      // 1. Dispatch pending / failed outbox records
      const dispatchSummary = await outboxDispatcher.dispatchAllPending({
        batchSize: 20,
        maxBatches: 3,
      });

      // 2. Reconcile expired checkout initializations & expired checkout URLs
      const cleanedOrders = await sql.begin(async (transaction) => {
        const expiredInitializing = await transaction`
          update payment_orders
          set status = 'financial_review',
              checkout_claim_token = null,
              checkout_claim_expires_at = null,
              checkout_error_code = 'CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN',
              provider_checkout_session_id = null,
              provider_checkout_url = null,
              checkout_expires_at = null,
              updated_at = clock_timestamp()
          where status = 'checkout_initializing'
            and checkout_claim_expires_at <= clock_timestamp()
          returning id
        `;

        const expiredCreated = await transaction`
          update payment_orders
          set status = 'financial_review',
              checkout_claim_token = null,
              checkout_claim_expires_at = null,
              provider_checkout_session_id = null,
              provider_checkout_url = null,
              checkout_expires_at = null,
              checkout_error_code = 'CHECKOUT_EXPIRED',
              updated_at = clock_timestamp()
          where status = 'checkout_created'
            and checkout_expires_at <= clock_timestamp()
          returning id
        `;

        return expiredInitializing.length + expiredCreated.length;
      });

      // 3. Reconcile timed-out generation jobs
      const timedOutJobs = await sql`
        update generation_jobs
        set status = 'timed_out',
            lease_token = null,
            lease_expires_at = null,
            structured_error_code = 'GENERATION_TIMEOUT',
            updated_at = clock_timestamp()
        where status in ('queued', 'running')
          and timeout_at <= clock_timestamp()
        returning id
      `;

      // 4. Release stranded reservations (when job failed/timed_out or lease expired)
      const releasedReservations = await sql.begin(async (transaction) => {
        const strandedRows = await transaction`
          select r.id as res_id, r.batch_id, r.user_id, r.casting_id, r.job_id
          from entitlement_reservations r
          left join generation_jobs j on j.id = r.job_id
          where r.status = 'reserved'
            and (
              j.status in ('failed', 'timed_out', 'dead_letter')
              or (r.lease_expires_at is not null and r.lease_expires_at <= clock_timestamp())
              or (j.id is null and r.created_at <= clock_timestamp() - interval '10 minutes')
            )
          for update of r
        ` as Array<{
          res_id: string;
          batch_id: string;
          user_id: string;
          casting_id: string;
          job_id: string | null;
        }>;

        let releasedCount = 0;

        for (const row of strandedRows) {
          await transaction`
            update entitlement_reservations
            set status = 'released',
                lease_token = null,
                lease_expires_at = null,
                updated_at = clock_timestamp()
            where id = ${row.res_id} and status = 'reserved'
          `;

          await transaction`
            update entitlement_batches
            set quantity_reserved = greatest(0, quantity_reserved - 1),
                quantity_available = quantity_available + 1,
                updated_at = clock_timestamp()
            where id = ${row.batch_id}
          `;

          await transaction`
            insert into entitlement_ledger (
              id, batch_id, order_id, action, quantity, business_key, created_at
            )
            select
              ${randomUUID()}, ${row.batch_id}, b.order_id, 'release', 1,
              ${`release:${row.res_id}`}, clock_timestamp()
            from entitlement_batches b
            where b.id = ${row.batch_id}
            on conflict (business_key) do nothing
          `;

          releasedCount++;
        }

        return releasedCount;
      });

      // 5. Recover stuck workflow runs
      const recoveredRuns = await sql`
        update workflow_runs
        set status = 'failed',
            error_code = 'WORKFLOW_START_TIMED_OUT',
            updated_at = clock_timestamp()
        where status = 'start_pending'
          and created_at <= clock_timestamp() - interval '10 minutes'
        returning id
      `;

      const durationMs = Date.now() - startTime;

      return {
        outboxProcessed: dispatchSummary.processedCount,
        checkoutCleaned: cleanedOrders,
        jobsTimedOut: timedOutJobs.length,
        reservationsReleased: releasedReservations,
        workflowRunsRecovered: recoveredRuns.length,
        durationMs,
      };
    },
  };
}
