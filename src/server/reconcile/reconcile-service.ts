import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { OutboxDispatcher } from "@/server/payments/outbox-dispatcher";

export type ReconcileMetrics = {
  outboxProcessed: number;
  paymentsRecovered: number;
  refundsReconciled: number;
  checkoutCleaned: number;
  jobsTimedOut: number;
  reservationsReleased: number;
  workflowRunsRecovered: number;
  durationMs: number;
};

export interface ReconcileService {
  runReconcile(options?: { budgetMs?: number }): Promise<ReconcileMetrics>;
}

type PaymentRecoveryRunner = {
  run(options?: { limit?: number }): Promise<{ settled: number }>;
};

type RefundReconciliationRunner = {
  run(options?: { limit?: number }): Promise<{ claimed: number }>;
};

export function createReconcileService(dependencies: {
  sql: Sql;
  outboxDispatcher: OutboxDispatcher;
  paymentRecovery?: PaymentRecoveryRunner;
  refundReconciliation?: RefundReconciliationRunner;
}): ReconcileService {
  const { sql, outboxDispatcher, paymentRecovery, refundReconciliation } = dependencies;

  return {
    async runReconcile(options = {}): Promise<ReconcileMetrics> {
      const startTime = Date.now();
      const budgetMs = options.budgetMs ?? 10_000;
      const deadlineAt = startTime + budgetMs;

      let outboxProcessed = 0;
      let paymentsRecovered = 0;
      let refundsReconciled = 0;
      let checkoutCleaned = 0;
      let jobsTimedOut = 0;
      let reservationsReleased = 0;
      let workflowRunsRecovered = 0;

      const isBudgetExhausted = () => Date.now() >= deadlineAt;

      // 1. Dispatch pending / failed webhook outbox records.
      if (!isBudgetExhausted()) {
        const dispatchSummary = await outboxDispatcher.dispatchAllPending({
          batchSize: 20,
          maxBatches: 3,
          deadlineAt,
        });
        outboxProcessed = dispatchSummary.processedCount;
      }

      // 2. Recover a missed one-time payment webhook by authenticated provider READ.
      // This must run before expired checkout cleanup so a real succeeded payment
      // can become paid/granted instead of being prematurely frozen for review.
      if (!isBudgetExhausted() && paymentRecovery) {
        const paymentSummary = await paymentRecovery.run({ limit: 5 });
        paymentsRecovered = paymentSummary.settled;
      }

      // 3. Reconcile durable refund intents by authenticated provider READ only.
      if (!isBudgetExhausted() && refundReconciliation) {
        const refundSummary = await refundReconciliation.run({ limit: 5 });
        refundsReconciled = refundSummary.claimed;
      }

      // 4. Reconcile expired checkout initializations & expired checkout URLs.
      if (!isBudgetExhausted()) {
        checkoutCleaned = await sql.begin(async (transaction) => {
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
      }

      // 5. Reconcile timed-out generation jobs.
      if (!isBudgetExhausted()) {
        const timedOutRows = await sql`
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
        jobsTimedOut = timedOutRows.length;
      }

      // 6. Release stranded reservations.
      if (!isBudgetExhausted()) {
        reservationsReleased = await sql.begin(async (transaction) => {
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
            limit 50
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
            if (isBudgetExhausted()) break;
            await transaction`
              update entitlement_reservations
              set status = 'released', lease_token = null, lease_expires_at = null,
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
              select ${randomUUID()}, ${row.batch_id}, b.order_id, 'release', 1,
                ${`release:${row.res_id}`}, clock_timestamp()
              from entitlement_batches b
              where b.id = ${row.batch_id}
              on conflict (business_key) do nothing
            `;
            releasedCount++;
          }
          return releasedCount;
        });
      }

      // 7. Recover stuck workflow runs.
      if (!isBudgetExhausted()) {
        const recoveredRows = await sql`
          update workflow_runs
          set status = 'failed', error_code = 'WORKFLOW_START_TIMED_OUT', updated_at = clock_timestamp()
          where status = 'start_pending'
            and created_at <= clock_timestamp() - interval '10 minutes'
          returning id
        `;
        workflowRunsRecovered = recoveredRows.length;
      }

      const durationMs = Date.now() - startTime;
      try {
        await sql`
          insert into audit_events (
            id, category, action, entity_type, entity_id, payload, created_at
          ) values (
            ${randomUUID()}, 'reconcile', 'reconcile_sweep_completed', 'system', 'reconcile_cron',
            ${JSON.stringify({
              outboxProcessed,
              paymentsRecovered,
              refundsReconciled,
              checkoutCleaned,
              jobsTimedOut,
              reservationsReleased,
              workflowRunsRecovered,
              durationMs,
              budgetMs,
            })}::jsonb, clock_timestamp()
          )
        `;
      } catch {
        // Audit recording non-blocking.
      }

      return {
        outboxProcessed,
        paymentsRecovered,
        refundsReconciled,
        checkoutCleaned,
        jobsTimedOut,
        reservationsReleased,
        workflowRunsRecovered,
        durationMs,
      };
    },
  };
}
