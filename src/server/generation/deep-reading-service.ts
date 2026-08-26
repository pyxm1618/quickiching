import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { WorkflowStarter } from "@/server/workflows/workflow-starter";

type Row = Record<string, any>;

export type DeepReadingRequestResult = {
  jobId: string;
  reservationId: string;
  status: "queued" | "running" | "completed";
  output?: unknown;
};

export type DeepReadingStatusResult = {
  status: "not_started" | "queued" | "running" | "completed" | "failed" | "timed_out";
  output?: unknown;
  errorCode?: string;
};

export interface DeepReadingService {
  requestDeepReading(options: {
    userId: string;
    castingId: string;
  }): Promise<DeepReadingRequestResult>;

  getDeepReadingStatus(options: {
    userId: string;
    castingId: string;
  }): Promise<DeepReadingStatusResult>;
}

export function createDeepReadingService(dependencies: {
  sql: Sql;
  workflowStarter: WorkflowStarter;
}): DeepReadingService {
  const { sql, workflowStarter } = dependencies;

  return {
    async requestDeepReading(options): Promise<DeepReadingRequestResult> {
      const { userId, castingId } = options;

      return sql.begin(async (transaction) => {
        // 1. Verify user exists
        const userRows = await transaction`
          select id from users where id = ${userId} limit 1
        ` as Row[];
        const user = userRows[0];
        if (!user) {
          throw new Error("USER_NOT_FOUND");
        }

        // 2. Verify casting session exists, belongs to user, and is not deleted
        const sessionRows = await transaction`
          select id, user_id, deleted_at, generation_epoch, lifecycle, risk_status
          from casting_sessions
          where id = ${castingId}
          limit 1
          for update
        ` as Row[];
        const session = sessionRows[0];
        if (!session || String(session.user_id) !== userId || session.deleted_at != null) {
          throw new Error("CASTING_NOT_FOUND");
        }

        // 3. Check if completed deep reading result already exists
        const resultRows = await transaction`
          select output from deep_reading_results where casting_id = ${castingId} limit 1
        ` as Row[];
        if (resultRows[0]) {
          return {
            jobId: randomUUID(),
            reservationId: randomUUID(),
            status: "completed",
            output: resultRows[0].output,
          };
        }

        // 4. Check if there is already an active job
        const activeJobRows = await transaction`
          select j.id as job_id, j.status as job_status, r.id as res_id
          from generation_jobs j
          left join entitlement_reservations r on r.job_id = j.id and r.status = 'reserved'
          where j.casting_id = ${castingId} and j.kind = 'deep_reading' and j.status in ('queued', 'running')
          limit 1
        ` as Row[];
        if (activeJobRows[0]) {
          return {
            jobId: String(activeJobRows[0].job_id),
            reservationId: activeJobRows[0].res_id ? String(activeJobRows[0].res_id) : randomUUID(),
            status: activeJobRows[0].job_status as "queued" | "running",
          };
        }

        // 5. Find available entitlement batch (Earliest expiring first)
        const batchRows = await transaction`
          select id, quantity_available from entitlement_batches
          where user_id = ${userId} and quantity_available > 0 and expires_at > clock_timestamp()
          order by expires_at asc, created_at asc
          limit 1
          for update
        ` as Row[];
        const batch = batchRows[0];
        if (!batch) {
          throw new Error("INSUFFICIENT_CREDITS");
        }

        const jobId = randomUUID();
        const reservationId = randomUUID();
        const epoch = Number(session.generation_epoch);
        const idempotencyKey = `deep:${castingId}:${epoch}:${jobId}`;
        const inputSnapshotHash = createHash("sha256")
          .update(`${castingId}:${epoch}:${userId}`)
          .digest("hex");

        // 6. Atomically reserve credit, create job and reservation
        await transaction`
          update entitlement_batches
          set quantity_available = quantity_available - 1,
              quantity_reserved = quantity_reserved + 1,
              updated_at = clock_timestamp()
          where id = ${String(batch.id)}
        `;

        await transaction`
          insert into generation_jobs (
            id, casting_id, kind, status, generation_epoch, idempotency_key,
            input_snapshot_hash, timeout_at, created_at, updated_at
          ) values (
            ${jobId}, ${castingId}, 'deep_reading', 'queued', ${epoch}, ${idempotencyKey},
            ${inputSnapshotHash}, clock_timestamp() + interval '10 minutes', clock_timestamp(), clock_timestamp()
          )
        `;

        await transaction`
          insert into entitlement_reservations (
            id, batch_id, user_id, casting_id, job_id, status,
            expires_at, created_at, updated_at
          ) values (
            ${reservationId}, ${String(batch.id)}, ${userId}, ${castingId}, ${jobId}, 'reserved',
            now() + interval '12 months', clock_timestamp(), clock_timestamp()
          )
        `;

        await transaction`
          insert into entitlement_ledger (
            id, batch_id, order_id, action, quantity, business_key, created_at
          )
          select
            ${randomUUID()}, ${String(batch.id)}, b.order_id, 'reserve', 1,
            ${`reserve:${reservationId}`}, clock_timestamp()
          from entitlement_batches b
          where b.id = ${String(batch.id)}
          on conflict (business_key) do nothing
        `;

        // 7. Start workflow asynchronously
        await workflowStarter.startDeepReadingWorkflow({
          castingId,
          jobId,
          reservationId,
          idempotencyKey,
          generationEpoch: epoch,
        });

        return {
          jobId,
          reservationId,
          status: "queued",
        };
      });
    },

    async getDeepReadingStatus(options): Promise<DeepReadingStatusResult> {
      const { userId, castingId } = options;

      // 1. Verify user & casting ownership
      const userRows = await sql`select id from users where id = ${userId} limit 1` as Row[];
      if (!userRows[0]) {
        throw new Error("USER_NOT_FOUND");
      }

      const sessionRows = await sql`
        select id, user_id, deleted_at from casting_sessions where id = ${castingId} limit 1
      ` as Row[];
      if (!sessionRows[0] || String(sessionRows[0].user_id) !== userId || sessionRows[0].deleted_at != null) {
        throw new Error("CASTING_NOT_FOUND");
      }

      // 2. Check result
      const resultRows = await sql`
        select output from deep_reading_results where casting_id = ${castingId} limit 1
      ` as Row[];
      if (resultRows[0]) {
        return {
          status: "completed",
          output: resultRows[0].output,
        };
      }

      // 3. Check latest deep_reading job
      const jobRows = await sql`
        select status, structured_error_code from generation_jobs
        where casting_id = ${castingId} and kind = 'deep_reading'
        order by created_at desc
        limit 1
      ` as Row[];
      if (!jobRows[0]) {
        return { status: "not_started" };
      }

      return {
        status: jobRows[0].status as any,
        errorCode: jobRows[0].structured_error_code ? String(jobRows[0].structured_error_code) : undefined,
      };
    },
  };
}
