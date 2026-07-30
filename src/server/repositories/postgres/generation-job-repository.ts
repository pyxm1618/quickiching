import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type {
  GenerationJob,
  GenerationJobRepository,
  GenerationJobType,
} from "@/server/jobs/generation-job-service";
import type { GenerationAttemptAudit } from "@/server/ai/gateway-provider";

type PostgresJsonValue = Parameters<Sql["json"]>[0];

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function json(value: unknown): PostgresJsonValue {
  return JSON.parse(JSON.stringify(value)) as PostgresJsonValue;
}

function mapJob(row: Record<string, unknown>): GenerationJob {
  return {
    id: String(row.id),
    jobType: row.job_type as GenerationJobType,
    castingId: String(row.casting_session_id),
    readingId: row.reading_id ? String(row.reading_id) : null,
    reservationId: row.reservation_id ? String(row.reservation_id) : null,
    status: row.status as GenerationJob["status"],
    generationEpoch: Number(row.generation_epoch),
    snapshot: row.snapshot,
    timeoutAt: new Date(String(row.timeout_at)),
  };
}

export type GenerationOutboxMessage = {
  id: string;
  jobId: string;
  attempts: number;
};

export class PostgresGenerationJobRepository implements GenerationJobRepository {
  constructor(private readonly sql: Sql) {}

  async enqueue(input: {
    jobType: GenerationJobType;
    castingId: string;
    readingId: string | null;
    reservationId: string | null;
    snapshot: unknown;
    timeoutAt: Date;
    outboxTopic: "generation.requested";
  }): Promise<GenerationJob> {
    return this.sql.begin(async (tx) => {
      const jobId = id("job");
      const inserted = await tx`
        insert into generation_jobs (
          id, casting_session_id, reading_id, reservation_id, job_type,
          status, generation_epoch, snapshot, attempts, available_at,
          timeout_at, created_at, updated_at
        ) values (
          ${jobId}, ${input.castingId}, ${input.readingId}, ${input.reservationId}, ${input.jobType},
          'queued', 0, ${tx.json(json(input.snapshot))}, 0, now(),
          ${input.timeoutAt}, now(), now()
        )
        on conflict do nothing
        returning *
      `;
      const row = inserted[0] ?? (await tx`
        select * from generation_jobs
        where casting_session_id = ${input.castingId}
          and job_type = ${input.jobType}
          and status in ('queued', 'running')
        order by created_at desc
        limit 1
      `)[0];
      if (!row) throw new Error("GENERATION_JOB_ENQUEUE_CONFLICT");
      await tx`
        insert into outbox (
          id, topic, aggregate_id, payload, available_at, created_at
        ) values (
          ${`out_${row.id}`}, ${input.outboxTopic}, ${row.id},
          ${tx.json(json({ jobId: row.id }))}, now(), now()
        )
        on conflict do nothing
      `;
      return mapJob(row);
    });
  }

  async claim(jobId: string, now: Date): Promise<GenerationJob> {
    return this.sql.begin(async (tx) => {
      const [row] = await tx`select * from generation_jobs where id = ${jobId} for update`;
      if (!row) throw new Error("GENERATION_JOB_NOT_FOUND");
      if (["completed", "failed", "timed_out"].includes(String(row.status))) {
        throw new Error("GENERATION_JOB_TERMINAL");
      }
      if (row.status === "running" && new Date(String(row.timeout_at)).getTime() > now.getTime()) {
        throw new Error("GENERATION_JOB_ALREADY_RUNNING");
      }
      if (new Date(String(row.available_at)).getTime() > now.getTime()) {
        throw new Error("GENERATION_JOB_NOT_AVAILABLE");
      }
      const timeoutMs = row.job_type === "preview" ? 2 * 60 * 1000 : 5 * 60 * 1000;
      const [claimed] = await tx`
        update generation_jobs set
          status = 'running',
          generation_epoch = generation_epoch + 1,
          attempts = attempts + 1,
          claimed_at = ${now},
          timeout_at = ${new Date(now.getTime() + timeoutMs)},
          updated_at = ${now}
        where id = ${jobId}
        returning *
      `;
      return mapJob(claimed);
    });
  }

  async complete(input: {
    jobId: string;
    generationEpoch: number;
    output: unknown;
    attempts: GenerationAttemptAudit[];
    now: Date;
  }): Promise<boolean> {
    return this.sql.begin(async (tx) => {
      const [completed] = await tx`
        update generation_jobs set
          status = 'completed', completed_at = ${input.now}, updated_at = ${input.now}
        where id = ${input.jobId}
          and generation_epoch = ${input.generationEpoch}
          and status = 'running'
        returning *
      `;
      if (!completed) return false;

      for (const [index, attempt] of input.attempts.entries()) {
        await tx`
          insert into generation_attempts (
            job_id, generation_epoch, attempt_number, provider_request_id,
            model_id, prompt_version, input_tokens, output_tokens, total_tokens, created_at
          ) values (
            ${input.jobId}, ${input.generationEpoch}, ${index + 1}, ${attempt.providerRequestId},
            ${attempt.model}, ${attempt.promptVersion}, ${attempt.usage.inputTokens ?? null},
            ${attempt.usage.outputTokens ?? null}, ${attempt.usage.totalTokens ?? null}, ${input.now}
          )
          on conflict (job_id, generation_epoch, attempt_number) do nothing
        `;
      }

      if (completed.job_type === "preview") {
        const statement = (input.output as { relevanceStatement?: unknown }).relevanceStatement;
        if (typeof statement !== "string") throw new Error("PREVIEW_OUTPUT_INVALID");
        await tx`
          update previews set status = 'completed', relevance_statement = ${statement}, updated_at = ${input.now}
          where casting_session_id = ${completed.casting_session_id}
        `;
      } else {
        await tx`
          update readings set
            status = 'completed', report = ${tx.json(json(input.output))},
            generation_epoch = ${input.generationEpoch}, updated_at = ${input.now}
          where id = ${completed.reading_id}
            and generation_epoch < ${input.generationEpoch}
        `;
      }
      return true;
    });
  }

  async fail(input: {
    jobId: string;
    generationEpoch: number;
    errorCode: string;
    now: Date;
  }): Promise<{ terminal: boolean }> {
    return this.sql.begin(async (tx) => {
      const [job] = await tx`
        select * from generation_jobs
        where id = ${input.jobId}
          and generation_epoch = ${input.generationEpoch}
        for update
      `;
      if (!job || job.status !== "running") return { terminal: false };
      const terminal = Number(job.attempts) >= 3;
      if (terminal) {
        await tx`
          update generation_jobs set status = 'failed', last_error_code = ${input.errorCode}, updated_at = ${input.now}
          where id = ${input.jobId}
        `;
      } else {
        const backoffMs = Math.min(60_000, 2 ** Number(job.attempts) * 1000);
        await tx`
          update generation_jobs set
            status = 'queued', available_at = ${new Date(input.now.getTime() + backoffMs)},
            last_error_code = ${input.errorCode}, updated_at = ${input.now}
          where id = ${input.jobId}
        `;
      }
      return { terminal };
    });
  }

  async claimOutbox(limit: number, now: Date): Promise<GenerationOutboxMessage[]> {
    return this.sql.begin(async (tx) => {
      const rows = await tx`
        select id, aggregate_id, attempts from outbox
        where topic = 'generation.requested'
          and dispatched_at is null
          and available_at <= ${now}
        order by created_at
        for update skip locked
        limit ${limit}
      `;
      const messages: GenerationOutboxMessage[] = [];
      for (const row of rows) {
        await tx`
          update outbox set attempts = attempts + 1, available_at = ${new Date(now.getTime() + 60_000)}
          where id = ${row.id}
        `;
        messages.push({ id: String(row.id), jobId: String(row.aggregate_id), attempts: Number(row.attempts) + 1 });
      }
      return messages;
    });
  }

  async markOutboxDispatched(messageId: string, jobId: string, workflowRunId: string, now: Date): Promise<void> {
    await this.sql.begin(async (tx) => {
      await tx`update outbox set dispatched_at = ${now} where id = ${messageId} and dispatched_at is null`;
      await tx`update generation_jobs set workflow_run_id = ${workflowRunId}, updated_at = ${now} where id = ${jobId}`;
    });
  }

  async releaseOutbox(messageId: string, now: Date): Promise<void> {
    await this.sql`
      update outbox set available_at = ${now} where id = ${messageId} and dispatched_at is null
    `;
  }
}
