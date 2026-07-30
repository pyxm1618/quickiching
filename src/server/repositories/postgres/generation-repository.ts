import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { GenerationInput } from "@/server/ai";
import { decryptJson, encryptJson, type EncryptedBlob } from "@/lib/crypto";
import { DomainError } from "@/server/errors/domain-error";

const JOB_TIMEOUT_MS = 5 * 60_000;

type JobType = "preview" | "deep_reading";
type JobStatus = "queued" | "running" | "completed" | "failed" | "timed_out";

export type GenerationSnapshot = {
  userId: string;
  castingId: string;
  readingId: string | null;
  reservationId: string | null;
  input: GenerationInput;
  riskRuleVersion: string;
  promptVersion: string;
  schemaVersion: string;
};

export type GenerationJob = {
  id: string;
  castingId: string;
  readingId: string | null;
  jobType: JobType;
  status: JobStatus;
  generationEpoch: number;
  attempts: number;
  timeoutAt: Date;
  workflowRunId: string | null;
  snapshot: GenerationSnapshot;
};

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

function rowDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function encryptedBlob(value: unknown): EncryptedBlob {
  if (!value || typeof value !== "object") throw new Error("GENERATION_SNAPSHOT_INVALID");
  const record = value as Record<string, unknown>;
  if (![record.v, record.iv, record.tag, record.data].every((part) => typeof part === "string")) {
    throw new Error("GENERATION_SNAPSHOT_INVALID");
  }
  return record as EncryptedBlob;
}

export class PostgresGenerationRepository {
  constructor(private readonly sql: Sql) {}

  enqueuePreview(input: { castingId: string; userId: string; now: Date }) {
    return this.enqueue({ ...input, jobType: "preview" });
  }

  enqueueDeepReading(input: { castingId: string; userId: string; now: Date }) {
    return this.enqueue({ ...input, jobType: "deep_reading" });
  }

  private async enqueue(input: {
    castingId: string;
    userId: string;
    jobType: JobType;
    now: Date;
  }): Promise<{ jobId: string; generationEpoch: number; status: JobStatus; readingId: string | null }> {
    return this.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${`${input.castingId}:${input.jobType}`}, 0))`;
      const existingJobs = await tx`
        select * from generation_jobs
        where casting_session_id = ${input.castingId} and job_type = ${input.jobType}
        order by created_at asc
        limit 1
        for update
      `;
      const existingJob = existingJobs[0];
      if (existingJob && ["queued", "running", "completed"].includes(existingJob.status)) {
        return {
          jobId: existingJob.id,
          generationEpoch: Number(existingJob.generation_epoch),
          status: existingJob.status as JobStatus,
          readingId: existingJob.reading_id ?? null,
        };
      }

      const castingRows = await tx`
        select c.*, q.id as question_id, q.ciphertext, q.iv, q.auth_tag,
          q.encryption_key_version, r.line_values, r.primary_hexagram_number,
          r.moving_line_positions, r.relating_hexagram_number, r.algorithm_version as result_algorithm_version,
          r.classic_mapping_version
        from casting_sessions c
        join question_versions q on q.id = c.current_question_version_id
        join cast_results r on r.casting_session_id = c.id
        where c.id = ${input.castingId}
        for update of c
      `;
      const casting = castingRows[0];
      if (!casting || casting.user_id !== input.userId || casting.lifecycle !== "revealed") {
        throw new DomainError("CASTING_NOT_FOUND", "Casting session not found.", false);
      }
      if (casting.risk_status !== "allowed") {
        throw new DomainError("RISK_BLOCKED", "Personalized generation is not available for this question.", false);
      }
      const context = decryptJson<{ context: string }>({
        v: casting.encryption_key_version,
        iv: casting.iv,
        tag: casting.auth_tag,
        data: casting.ciphertext,
      }, "context", `${input.castingId}:${casting.question_id}`).context;

      const lineValues = casting.line_values as GenerationInput["result"]["lineValuesBottomUp"];
      const generationInput: GenerationInput = {
        context,
        scene: casting.scene,
        interpretationGoal: casting.interpretation_goal,
        result: {
          lineValuesBottomUp: lineValues,
          primaryHexagramNumber: Number(casting.primary_hexagram_number),
          movingLinePositions: (casting.moving_line_positions as number[]).map(Number),
          relatingHexagramNumber: casting.relating_hexagram_number == null
            ? null
            : Number(casting.relating_hexagram_number),
          method: casting.method,
          algorithmVersion: casting.result_algorithm_version,
          classicMappingVersion: casting.classic_mapping_version,
        },
      };

      let readingId: string | null = null;
      let reservationId: string | null = null;
      if (input.jobType === "preview") {
        const previews = await tx`
          insert into previews (id, casting_session_id, status, schema_version, created_at, updated_at)
          values (${id("prev")}, ${input.castingId}, 'queued', 'preview-v1', ${input.now}, ${input.now})
          on conflict (casting_session_id) do update set
            status = case when previews.status = 'completed' then previews.status else 'queued'::preview_status end,
            updated_at = excluded.updated_at
          returning id, status
        `;
        if (previews[0].status === "completed") {
          const completed = await tx`
            select id, generation_epoch, status, reading_id from generation_jobs
            where casting_session_id = ${input.castingId} and job_type = 'preview'
            order by created_at asc limit 1
          `;
          if (completed[0]) {
            return {
              jobId: completed[0].id,
              generationEpoch: Number(completed[0].generation_epoch),
              status: completed[0].status as JobStatus,
              readingId: null,
            };
          }
        }
      } else {
        const readings = await tx`
          insert into readings (id, casting_session_id, status, schema_version, generation_epoch, created_at, updated_at)
          values (${id("rdg")}, ${input.castingId}, 'not_started', 'reading-v1', 0, ${input.now}, ${input.now})
          on conflict (casting_session_id) do update set updated_at = readings.updated_at
          returning id, status, reservation_id
        `;
        const reading = readings[0];
        readingId = reading.id;
        if (reading.status === "completed") {
          const completed = await tx`
            select id, generation_epoch, status, reading_id from generation_jobs
            where casting_session_id = ${input.castingId} and job_type = 'deep_reading'
            order by created_at asc limit 1
          `;
          if (completed[0]) {
            return {
              jobId: completed[0].id,
              generationEpoch: Number(completed[0].generation_epoch),
              status: completed[0].status as JobStatus,
              readingId,
            };
          }
        }
        if (reading.reservation_id) {
          const reservations = await tx`
            select id, status from reservations where id = ${reading.reservation_id} for update
          `;
          if (reservations[0] && ["reserved", "consumed"].includes(reservations[0].status)) {
            reservationId = reservations[0].id;
          }
        }
        if (!reservationId) {
          const batches = await tx`
            select id from entitlement_batches
            where user_id = ${input.userId}
              and quantity_available > 0
              and expires_at > ${input.now}
            order by expires_at asc, created_at asc, id asc
            limit 1
            for update skip locked
          `;
          if (!batches[0]) {
            throw new DomainError("ENTITLEMENT_NOT_AVAILABLE", "You have no available reading credit.", false);
          }
          const batchId = batches[0].id;
          reservationId = id("res");
          await tx`
            update entitlement_batches set
              quantity_available = quantity_available - 1,
              quantity_reserved = quantity_reserved + 1,
              updated_at = ${input.now}
            where id = ${batchId}
          `;
          await tx`
            insert into reservations (id, reading_id, batch_id, status, created_at, updated_at)
            values (${reservationId}, ${readingId}, ${batchId}, 'reserved', ${input.now}, ${input.now})
          `;
          await tx`
            insert into entitlement_ledger (
              id, batch_id, action, quantity, reading_id, reservation_id, created_at
            ) values (${id("led")}, ${batchId}, 'reserve', 1, ${readingId}, ${reservationId}, ${input.now})
          `;
        }
        await tx`
          update readings set status = 'queued', reservation_id = ${reservationId},
            generation_epoch = generation_epoch + 1, updated_at = ${input.now}
          where id = ${readingId}
        `;
      }

      const jobId = existingJob?.id ?? id("job");
      const epoch = existingJob ? Number(existingJob.generation_epoch) + 1 : 1;
      const snapshot: GenerationSnapshot = {
        userId: input.userId,
        castingId: input.castingId,
        readingId,
        reservationId,
        input: generationInput,
        riskRuleVersion: "risk-v2",
        promptVersion: "reading-prompt-v2.1",
        schemaVersion: input.jobType === "preview" ? "preview-v1" : "reading-v1",
      };
      const encrypted = encryptJson(snapshot, "context", undefined, `generation:${jobId}:${epoch}`);
      const timeoutAt = new Date(input.now.getTime() + JOB_TIMEOUT_MS);

      if (existingJob) {
        await tx`
          update generation_jobs set
            status = 'queued', generation_epoch = ${epoch}, snapshot = ${tx.json(encrypted as never)},
            snapshot_encryption_key_version = ${encrypted.v}, attempts = 0, available_at = ${input.now},
            timeout_at = ${timeoutAt}, claimed_at = null, completed_at = null, worker_id = null,
            workflow_run_id = null, last_error_code = null, error_code = null, updated_at = ${input.now}
          where id = ${jobId}
        `;
      } else {
        await tx`
          insert into generation_jobs (
            id, casting_session_id, reading_id, job_type, status, generation_epoch,
            snapshot, snapshot_encryption_key_version, attempts, available_at,
            timeout_at, created_at, updated_at
          ) values (
            ${jobId}, ${input.castingId}, ${readingId}, ${input.jobType}, 'queued', ${epoch},
            ${tx.json(encrypted as never)}, ${encrypted.v}, 0, ${input.now}, ${timeoutAt}, ${input.now}, ${input.now}
          )
        `;
      }
      await tx`
        insert into outbox (id, topic, aggregate_id, payload, available_at, created_at)
        values (
          ${id("out")}, 'generation.requested', ${jobId},
          ${tx.json({ jobId, generationEpoch: epoch } as never)}, ${input.now}, ${input.now}
        )
      `;
      return { jobId, generationEpoch: epoch, status: "queued", readingId };
    });
  }

  async claimNext(input: { workerId: string; now: Date }): Promise<GenerationJob | null> {
    return this.sql.begin(async (tx) => {
      const rows = await tx`
        select * from generation_jobs
        where status = 'queued' and available_at <= ${input.now} and timeout_at > ${input.now}
        order by created_at asc
        limit 1
        for update skip locked
      `;
      const job = rows[0];
      if (!job) return null;
      const attemptNumber = Number(job.attempts) + 1;
      await tx`
        update generation_jobs set status = 'running', attempts = ${attemptNumber},
          claimed_at = ${input.now}, worker_id = ${input.workerId}, updated_at = ${input.now}
        where id = ${job.id}
      `;
      await tx`
        insert into generation_attempts (
          id, job_id, generation_epoch, attempt_number, model_id, prompt_version,
          schema_version, status, started_at
        ) values (
          ${id("att")}, ${job.id}, ${job.generation_epoch}, ${attemptNumber}, 'pending-model',
          'reading-prompt-v2.1', ${job.job_type === "preview" ? "preview-v1" : "reading-v1"},
          'running', ${input.now}
        )
      `;
      return this.mapJob({ ...job, status: "running", attempts: attemptNumber, worker_id: input.workerId });
    });
  }

  async getJob(jobId: string, generationEpoch?: number): Promise<GenerationJob | null> {
    const rows = generationEpoch == null
      ? await this.sql`select * from generation_jobs where id = ${jobId}`
      : await this.sql`select * from generation_jobs where id = ${jobId} and generation_epoch = ${generationEpoch}`;
    return rows[0] ? this.mapJob(rows[0]) : null;
  }

  async markWorkflowRun(input: { jobId: string; generationEpoch: number; workflowRunId: string; now: Date }): Promise<boolean> {
    const changed = await this.sql`
      update generation_jobs set workflow_run_id = ${input.workflowRunId}, updated_at = ${input.now}
      where id = ${input.jobId} and generation_epoch = ${input.generationEpoch}
        and status in ('queued', 'running')
      returning id
    `;
    return changed.length === 1;
  }

  async failAttempt(input: {
    jobId: string;
    generationEpoch: number;
    errorCode: string;
    retryable: boolean;
    now: Date;
  }): Promise<{ accepted: boolean }> {
    return this.sql.begin(async (tx) => {
      const rows = await tx`select * from generation_jobs where id = ${input.jobId} for update`;
      const job = rows[0];
      if (!job || Number(job.generation_epoch) !== input.generationEpoch || job.status !== "running") {
        return { accepted: false };
      }
      await tx`
        update generation_attempts set status = 'failed', error_code = ${input.errorCode},
          error_class = ${input.retryable ? "retryable" : "terminal"}, finished_at = ${input.now}
        where job_id = ${input.jobId} and generation_epoch = ${input.generationEpoch}
          and attempt_number = ${job.attempts}
      `;
      await tx`
        update generation_jobs set status = 'failed', error_code = ${input.errorCode},
          last_error_code = ${input.errorCode}, completed_at = ${input.now}, updated_at = ${input.now}
        where id = ${input.jobId}
      `;
      if (job.job_type === "preview") {
        await tx`update previews set status = 'failed', relevance_statement = null, updated_at = ${input.now} where casting_session_id = ${job.casting_session_id}`;
      }
      return { accepted: true };
    });
  }

  async retry(input: { jobId: string; now: Date }): Promise<{
    jobId: string;
    generationEpoch: number;
    status: "queued";
  }> {
    return this.sql.begin(async (tx) => {
      const rows = await tx`select * from generation_jobs where id = ${input.jobId} for update`;
      const job = rows[0];
      if (!job || !["failed", "timed_out"].includes(job.status)) {
        throw new DomainError("GENERATION_RETRY_NOT_ALLOWED", "This generation cannot be retried.", false);
      }
      const nextEpoch = Number(job.generation_epoch) + 1;
      const snapshot = decryptJson<GenerationSnapshot>(
        encryptedBlob(job.snapshot),
        "context",
        `generation:${job.id}:${job.generation_epoch}`,
      );
      const encrypted = encryptJson(snapshot, "context", undefined, `generation:${job.id}:${nextEpoch}`);
      const timeoutAt = new Date(input.now.getTime() + JOB_TIMEOUT_MS);
      await tx`
        update generation_jobs set status = 'queued', generation_epoch = ${nextEpoch},
          snapshot = ${tx.json(encrypted as never)}, snapshot_encryption_key_version = ${encrypted.v},
          attempts = 0, available_at = ${input.now}, timeout_at = ${timeoutAt}, claimed_at = null,
          completed_at = null, workflow_run_id = null, worker_id = null, error_code = null,
          last_error_code = null, updated_at = ${input.now}
        where id = ${job.id}
      `;
      if (job.job_type === "preview") {
        await tx`update previews set status = 'queued', relevance_statement = null, updated_at = ${input.now} where casting_session_id = ${job.casting_session_id}`;
      } else if (job.reading_id) {
        await tx`update readings set status = 'queued', generation_epoch = ${nextEpoch}, updated_at = ${input.now} where id = ${job.reading_id}`;
      }
      await tx`
        insert into outbox (id, topic, aggregate_id, payload, available_at, created_at)
        values (${id("out")}, 'generation.requested', ${job.id}, ${tx.json({ jobId: job.id, generationEpoch: nextEpoch } as never)}, ${input.now}, ${input.now})
      `;
      return { jobId: job.id, generationEpoch: nextEpoch, status: "queued" };
    });
  }

  async finalizePreview(input: {
    jobId: string;
    generationEpoch: number;
    output: { relevanceStatement: string };
    providerRequestId: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    latencyMs: number;
    now: Date;
  }): Promise<{ accepted: true } | { accepted: false; code: "LATE_RESULT_REJECTED" }> {
    return this.sql.begin(async (tx) => {
      const rows = await tx`select * from generation_jobs where id = ${input.jobId} for update`;
      const job = rows[0];
      if (!job || Number(job.generation_epoch) !== input.generationEpoch || job.status !== "running" || job.job_type !== "preview") {
        return { accepted: false, code: "LATE_RESULT_REJECTED" };
      }
      await tx`
        update previews set status = 'completed', relevance_statement = ${input.output.relevanceStatement}, updated_at = ${input.now}
        where casting_session_id = ${job.casting_session_id}
      `;
      await this.completeAttempt(tx, job, input);
      await tx`
        update generation_jobs set status = 'completed', completed_at = ${input.now}, updated_at = ${input.now}
        where id = ${job.id}
      `;
      return { accepted: true };
    });
  }

  async finalizeReading(input: {
    jobId: string;
    generationEpoch: number;
    output: Record<string, unknown>;
    providerRequestId: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    latencyMs: number;
    now: Date;
  }): Promise<{ accepted: true } | { accepted: false; code: "LATE_RESULT_REJECTED" }> {
    return this.sql.begin(async (tx) => {
      const rows = await tx`select * from generation_jobs where id = ${input.jobId} for update`;
      const job = rows[0];
      if (!job || Number(job.generation_epoch) !== input.generationEpoch || job.status !== "running" || job.job_type !== "deep_reading" || !job.reading_id) {
        return { accepted: false, code: "LATE_RESULT_REJECTED" };
      }
      const readings = await tx`select * from readings where id = ${job.reading_id} for update`;
      const reading = readings[0];
      if (!reading || reading.status !== "queued" && reading.status !== "reserved" || !reading.reservation_id) {
        return { accepted: false, code: "LATE_RESULT_REJECTED" };
      }
      const reservations = await tx`select * from reservations where id = ${reading.reservation_id} for update`;
      const reservation = reservations[0];
      if (!reservation || reservation.status !== "reserved") {
        return { accepted: false, code: "LATE_RESULT_REJECTED" };
      }
      await tx`select id from entitlement_batches where id = ${reservation.batch_id} for update`;
      await tx`
        update entitlement_batches set quantity_reserved = quantity_reserved - 1,
          quantity_consumed = quantity_consumed + 1, updated_at = ${input.now}
        where id = ${reservation.batch_id}
      `;
      await tx`
        update reservations set status = 'consumed', updated_at = ${input.now}
        where id = ${reservation.id}
      `;
      await tx`
        insert into entitlement_ledger (id, batch_id, action, quantity, reading_id, reservation_id, created_at)
        values (${id("led")}, ${reservation.batch_id}, 'consume', 1, ${reading.id}, ${reservation.id}, ${input.now})
      `;
      await tx`
        update readings set status = 'completed', report = ${tx.json(input.output as never)},
          generation_epoch = ${input.generationEpoch}, updated_at = ${input.now}
        where id = ${reading.id}
      `;
      await this.completeAttempt(tx, job, input);
      await tx`
        update generation_jobs set status = 'completed', completed_at = ${input.now}, updated_at = ${input.now}
        where id = ${job.id}
      `;
      return { accepted: true };
    });
  }

  async reconcileTimeouts(now: Date): Promise<Array<{
    jobId: string;
    generationEpoch: number;
    status: "failed";
  }>> {
    return this.sql.begin(async (tx) => {
      const jobs = await tx`
        select * from generation_jobs
        where status in ('queued', 'running') and timeout_at <= ${now}
        order by timeout_at asc
        for update skip locked
      `;
      const outcomes: Array<{ jobId: string; generationEpoch: number; status: "failed" }> = [];
      for (const job of jobs) {
        if (job.job_type === "preview") {
          await tx`update previews set status = 'failed', relevance_statement = null, updated_at = ${now} where casting_session_id = ${job.casting_session_id}`;
        } else if (job.reading_id) {
          const readings = await tx`select * from readings where id = ${job.reading_id} for update`;
          const reading = readings[0];
          if (reading?.reservation_id) {
            const reservations = await tx`select * from reservations where id = ${reading.reservation_id} for update`;
            const reservation = reservations[0];
            if (reservation?.status === "reserved") {
              const batches = await tx`select * from entitlement_batches where id = ${reservation.batch_id} for update`;
              const batch = batches[0];
              const expired = rowDate(batch.expires_at).getTime() <= now.getTime();
              if (expired) {
                await tx`update entitlement_batches set quantity_reserved = quantity_reserved - 1, quantity_revoked = quantity_revoked + 1, updated_at = ${now} where id = ${batch.id}`;
              } else {
                await tx`update entitlement_batches set quantity_reserved = quantity_reserved - 1, quantity_available = quantity_available + 1, updated_at = ${now} where id = ${batch.id}`;
              }
              await tx`update reservations set status = ${expired ? "expired" : "released"}, updated_at = ${now} where id = ${reservation.id}`;
              await tx`
                insert into entitlement_ledger (id, batch_id, action, quantity, reading_id, reservation_id, created_at)
                values (${id("led")}, ${batch.id}, ${expired ? "revoke" : "release"}, 1, ${reading.id}, ${reservation.id}, ${now})
              `;
            }
          }
          await tx`update readings set status = 'failed', reservation_id = null, updated_at = ${now} where id = ${job.reading_id}`;
        }
        await tx`
          update generation_jobs set status = 'failed', error_code = 'GENERATION_TIMED_OUT',
            last_error_code = 'GENERATION_TIMED_OUT', completed_at = ${now}, updated_at = ${now}
          where id = ${job.id}
        `;
        await tx`
          update generation_attempts set status = 'failed', error_class = 'timeout',
            error_code = 'GENERATION_TIMED_OUT', finished_at = ${now}
          where job_id = ${job.id} and generation_epoch = ${job.generation_epoch} and status = 'running'
        `;
        outcomes.push({ jobId: job.id, generationEpoch: Number(job.generation_epoch), status: "failed" });
      }
      return outcomes;
    });
  }

  async listUndispatchedOutbox(limit = 25): Promise<Array<{
    id: string;
    jobId: string;
    generationEpoch: number;
  }>> {
    const rows = await this.sql`
      select id, aggregate_id, payload from outbox
      where dispatched_at is null and available_at <= now() and topic = 'generation.requested'
      order by created_at asc limit ${limit}
    `;
    return rows.map((row) => ({
      id: row.id,
      jobId: row.aggregate_id,
      generationEpoch: Number((row.payload as { generationEpoch: number }).generationEpoch),
    }));
  }

  async markOutboxDispatched(input: { outboxId: string; now: Date }): Promise<boolean> {
    const rows = await this.sql`
      update outbox set dispatched_at = ${input.now}, attempts = attempts + 1
      where id = ${input.outboxId} and dispatched_at is null
      returning id
    `;
    return rows.length === 1;
  }

  private mapJob(row: Record<string, any>): GenerationJob {
    const epoch = Number(row.generation_epoch);
    return {
      id: row.id,
      castingId: row.casting_session_id,
      readingId: row.reading_id ?? null,
      jobType: row.job_type,
      status: row.status,
      generationEpoch: epoch,
      attempts: Number(row.attempts),
      timeoutAt: rowDate(row.timeout_at),
      workflowRunId: row.workflow_run_id ?? null,
      snapshot: decryptJson<GenerationSnapshot>(
        encryptedBlob(row.snapshot),
        "context",
        `generation:${row.id}:${epoch}`,
      ),
    };
  }

  private async completeAttempt(tx: any, job: Record<string, any>, input: {
    providerRequestId: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    latencyMs: number;
    now: Date;
  }): Promise<void> {
    await tx`
      update generation_attempts set status = 'completed', provider_request_id = ${input.providerRequestId},
        input_tokens = ${input.inputTokens}, output_tokens = ${input.outputTokens},
        latency_ms = ${input.latencyMs}, finished_at = ${input.now}
      where job_id = ${job.id} and generation_epoch = ${job.generation_epoch}
        and attempt_number = ${job.attempts}
    `;
  }
}
