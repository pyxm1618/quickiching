import { randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import type { WorkflowStarter } from "@/server/workflows/workflow-starter";
import type { DeterministicFacts } from "@/domain/generation/schemas";
import { calculateDeepReadingInputSnapshotHash } from "@/server/generation/integrity";
import { decryptQuestionForGeneration } from "@/server/generation/question-crypto";

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

function readingVariant(movingLinePositions: number[]): DeterministicFacts["readingVariant"] {
  if (movingLinePositions.length === 0) return "still_hexagram";
  if (movingLinePositions.length === 6) return "all_lines_moving";
  if (movingLinePositions.length > 1) return "multiple_moving";
  return "standard";
}

async function compensateWorkflowStartFailure(
  transaction: TransactionSql,
  input: {
    jobId: string;
    reservationId: string;
    idempotencyKey: string;
    castingId: string;
    userId: string;
    generationEpoch: number;
  },
): Promise<boolean> {
  const failedJobs = await transaction`
    update generation_jobs
    set status = 'failed', structured_error_code = 'WORKFLOW_START_FAILED',
        lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
    where id = ${input.jobId} and casting_id = ${input.castingId}
      and generation_epoch = ${input.generationEpoch} and status = 'queued'
    returning id
  ` as Row[];

  // A provider start can have an uncertain outcome. If a real worker already
  // claimed the job, do not release its reservation out from under it.
  if (!failedJobs[0]) return false;

  const reservationRows = await transaction`
    select id, batch_id, user_id
    from entitlement_reservations
    where id = ${input.reservationId} and job_id = ${input.jobId} and status = 'reserved'
    limit 1
    for update
  ` as Row[];
  const reservation = reservationRows[0];

  if (reservation) {
    await transaction`
      update entitlement_reservations
      set status = 'released', lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
      where id = ${input.reservationId} and status = 'reserved'
    `;
    await transaction`
      update entitlement_batches
      set quantity_reserved = greatest(0, quantity_reserved - 1),
          quantity_available = quantity_available + 1,
          updated_at = clock_timestamp()
      where id = ${String(reservation.batch_id)}
    `;
    await transaction`
      insert into entitlement_ledger (
        id, batch_id, order_id, action, quantity, business_key, created_at
      )
      select ${randomUUID()}, ${String(reservation.batch_id)}, b.order_id, 'release', 1,
             ${`release:${input.reservationId}`}, clock_timestamp()
      from entitlement_batches b
      where b.id = ${String(reservation.batch_id)}
      on conflict (business_key) do nothing
    `;
  }

  await transaction`
    update workflow_runs
    set status = 'failed', error_code = 'WORKFLOW_START_FAILED', updated_at = clock_timestamp()
    where idempotency_key = ${input.idempotencyKey}
  `;

  await transaction`
    insert into audit_events (
      id, category, action, entity_type, entity_id, user_id, payload, created_at
    ) values (
      ${randomUUID()}, 'generation', 'deep_reading_start_failed', 'job', ${input.jobId},
      ${input.userId}, ${JSON.stringify({
        castingId: input.castingId,
        reservationId: input.reservationId,
        errorCode: "WORKFLOW_START_FAILED",
      })}::jsonb, clock_timestamp()
    )
  `;

  return true;
}

export function createDeepReadingService(dependencies: {
  sql: Sql;
  workflowStarter: WorkflowStarter;
}): DeepReadingService {
  const { sql, workflowStarter } = dependencies;

  return {
    async requestDeepReading(options): Promise<DeepReadingRequestResult> {
      const { userId, castingId } = options;

      const prepared = await sql.begin(async (transaction) => {
        const userRows = await transaction`
          select id from users where id = ${userId} limit 1
        ` as Row[];
        if (!userRows[0]) throw new Error("USER_NOT_FOUND");

        const sessionRows = await transaction`
          select
            c.id, c.user_id, c.deleted_at, c.generation_epoch, c.lifecycle, c.risk_status,
            c.scene, c.interpretation_goal, c.method,
            q.id as question_version_id, q.ciphertext as question_ciphertext,
            q.iv as question_iv, q.auth_tag as question_auth_tag,
            q.encryption_key_version as question_encryption_key_version,
            r.line_values, r.primary_hexagram_number, r.moving_line_positions,
            r.relating_hexagram_number, r.algorithm_version, r.classic_mapping_version,
            r.result_hmac, r.result_hmac_key_version
          from casting_sessions c
          left join lateral (
            select * from question_versions
            where casting_id = c.id
            order by version_number desc
            limit 1
          ) q on true
          left join cast_results r on r.casting_id = c.id
          where c.id = ${castingId}
          limit 1
          for update of c
        ` as Row[];
        const session = sessionRows[0];
        if (!session || String(session.user_id) !== userId || session.deleted_at != null) {
          throw new Error("CASTING_NOT_FOUND");
        }
        if (session.lifecycle !== "revealed") throw new Error("CASTING_NOT_READY");
        if (session.risk_status !== "allowed") throw new Error("RISK_PROHIBITED");
        if (!session.result_hmac) throw new Error("CAST_RESULT_UNAVAILABLE");

        const resultRows = await transaction`
          select job_id, reservation_id, output from deep_reading_results where casting_id = ${castingId} limit 1
        ` as Row[];
        if (resultRows[0]) {
          return {
            alreadyCompleted: true as const,
            jobId: String(resultRows[0].job_id),
            reservationId: String(resultRows[0].reservation_id),
            output: resultRows[0].output,
          };
        }

        const activeJobRows = await transaction`
          select j.id as job_id, j.status as job_status, r.id as res_id
          from generation_jobs j
          left join entitlement_reservations r on r.job_id = j.id and r.status = 'reserved'
          where j.casting_id = ${castingId} and j.kind = 'deep_reading' and j.status in ('queued', 'running')
          limit 1
        ` as Row[];
        if (activeJobRows[0]) {
          return {
            alreadyActive: true as const,
            jobId: String(activeJobRows[0].job_id),
            reservationId: activeJobRows[0].res_id ? String(activeJobRows[0].res_id) : "",
            status: activeJobRows[0].job_status as "queued" | "running",
          };
        }

        const batchRows = await transaction`
          select id, quantity_available from entitlement_batches
          where user_id = ${userId} and quantity_available > 0 and expires_at > clock_timestamp()
          order by expires_at asc, created_at asc
          limit 1
          for update
        ` as Row[];
        const batch = batchRows[0];
        if (!batch) throw new Error("INSUFFICIENT_CREDITS");

        const jobId = randomUUID();
        const reservationId = randomUUID();
        const initialLeaseToken = randomUUID();
        const epoch = Number(session.generation_epoch);
        const idempotencyKey = `deep:${castingId}:${epoch}:${jobId}`;

        // Fail closed before any entitlement mutation if the stored encrypted
        // question cannot be authenticated with its declared key version.
        const questionText = decryptQuestionForGeneration(session);
        const lineValues = (session.line_values as number[]) ?? [];
        const movingLinePositions = (session.moving_line_positions as number[]) ?? [];
        const facts: DeterministicFacts = {
          method: session.method as any,
          algorithmVersion: String(session.algorithm_version),
          classicMappingVersion: String(session.classic_mapping_version),
          lineValuesBottomUp: [
            Number(lineValues[0]), Number(lineValues[1]), Number(lineValues[2]),
            Number(lineValues[3]), Number(lineValues[4]), Number(lineValues[5]),
          ] as any,
          primaryHexagramNumber: Number(session.primary_hexagram_number),
          movingLinePositions,
          relatingHexagramNumber: session.relating_hexagram_number ? Number(session.relating_hexagram_number) : null,
          readingVariant: readingVariant(movingLinePositions),
        };

        const inputSnapshotHash = calculateDeepReadingInputSnapshotHash({
          castingId,
          userId,
          epoch,
          question: questionText,
          scene: String(session.scene),
          interpretationGoal: String(session.interpretation_goal),
          facts,
        });

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
            id, batch_id, user_id, casting_id, job_id, status, lease_token,
            expires_at, created_at, updated_at
          ) values (
            ${reservationId}, ${String(batch.id)}, ${userId}, ${castingId}, ${jobId}, 'reserved',
            ${initialLeaseToken}, now() + interval '12 months', clock_timestamp(), clock_timestamp()
          )
        `;

        await transaction`
          insert into entitlement_ledger (
            id, batch_id, order_id, action, quantity, business_key, created_at
          )
          select ${randomUUID()}, ${String(batch.id)}, b.order_id, 'reserve', 1,
                 ${`reserve:${reservationId}`}, clock_timestamp()
          from entitlement_batches b
          where b.id = ${String(batch.id)}
          on conflict (business_key) do nothing
        `;

        await transaction`
          insert into workflow_runs (
            id, workflow_name, idempotency_key, entity_type, entity_id, status, created_at, updated_at
          ) values (
            ${randomUUID()}, 'deep_reading', ${idempotencyKey}, 'casting', ${castingId},
            'start_pending', clock_timestamp(), clock_timestamp()
          )
        `;

        await transaction`
          insert into audit_events (
            id, category, action, entity_type, entity_id, user_id, payload, created_at
          ) values (
            ${randomUUID()}, 'entitlement', 'credit_reserved', 'reservation', ${reservationId},
            ${userId}, ${JSON.stringify({ castingId, jobId, batchId: String(batch.id) })}::jsonb,
            clock_timestamp()
          )
        `;

        return {
          alreadyCompleted: false as const,
          alreadyActive: false as const,
          jobId,
          reservationId,
          idempotencyKey,
          epoch,
        };
      });

      if (prepared.alreadyCompleted) {
        return {
          jobId: prepared.jobId,
          reservationId: prepared.reservationId,
          status: "completed",
          output: prepared.output,
        };
      }
      if (prepared.alreadyActive) {
        return {
          jobId: prepared.jobId,
          reservationId: prepared.reservationId,
          status: prepared.status,
        };
      }

      try {
        const started = await workflowStarter.startDeepReadingWorkflow({
          castingId,
          jobId: prepared.jobId,
          reservationId: prepared.reservationId,
          idempotencyKey: prepared.idempotencyKey,
          generationEpoch: prepared.epoch,
        });
        if (!started.started) throw new Error("WORKFLOW_START_FAILED");
      } catch {
        await sql.begin((transaction) => compensateWorkflowStartFailure(transaction, {
          jobId: prepared.jobId,
          reservationId: prepared.reservationId,
          idempotencyKey: prepared.idempotencyKey,
          castingId,
          userId,
          generationEpoch: prepared.epoch,
        }));
        throw new Error("WORKFLOW_START_FAILED");
      }

      return {
        jobId: prepared.jobId,
        reservationId: prepared.reservationId,
        status: "queued",
      };
    },

    async getDeepReadingStatus(options): Promise<DeepReadingStatusResult> {
      const { userId, castingId } = options;
      const userRows = await sql`select id from users where id = ${userId} limit 1` as Row[];
      if (!userRows[0]) throw new Error("USER_NOT_FOUND");

      const sessionRows = await sql`
        select id, user_id, deleted_at from casting_sessions where id = ${castingId} limit 1
      ` as Row[];
      if (!sessionRows[0] || String(sessionRows[0].user_id) !== userId || sessionRows[0].deleted_at != null) {
        throw new Error("CASTING_NOT_FOUND");
      }

      const resultRows = await sql`
        select output from deep_reading_results where casting_id = ${castingId} limit 1
      ` as Row[];
      if (resultRows[0]) return { status: "completed", output: resultRows[0].output };

      const jobRows = await sql`
        select status, structured_error_code from generation_jobs
        where casting_id = ${castingId} and kind = 'deep_reading'
        order by created_at desc
        limit 1
      ` as Row[];
      if (!jobRows[0]) return { status: "not_started" };

      return {
        status: jobRows[0].status as any,
        errorCode: jobRows[0].structured_error_code ? String(jobRows[0].structured_error_code) : undefined,
      };
    },
  };
}
