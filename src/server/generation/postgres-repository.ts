import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { previewOutputSchema, type DeterministicFacts } from "@/domain/generation/schemas";
import { decryptJson, decryptJsonWithKeyMaterial } from "@/lib/crypto";
import { hashGenerationSnapshot } from "./boundary";
import {
  PREVIEW_RETRY_BUDGET_MAX_FAILURES,
  PREVIEW_RETRY_BUDGET_WINDOW_MS,
  STALE_PREVIEW_INVALIDATED_ERROR,
} from "./retry-policy";
import type {
  CreateJobInput,
  GenerationJobRecord,
  PersistPreviewSuccessInput,
  PreviewGenerationContext,
  PreviewGenerationRepository,
  PreviewResultRecord,
} from "./types";

type Row = Record<string, any>;
type RuntimeEnv = Record<string, string | undefined>;

function configuredKeyMaterial(raw: string | undefined, version: string): string | null {
  if (!raw?.trim()) return null;
  for (const entry of raw.split(",")) {
    const match = /^([A-Za-z0-9][A-Za-z0-9._-]*):(.+)$/.exec(entry.trim());
    if (match?.[1] === version && match[2].trim()) return match[2].trim();
  }
  throw new Error("QUESTION_ENCRYPTION_KEY_UNAVAILABLE");
}

function date(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function jobFromRow(row: Row): GenerationJobRecord {
  return {
    id: String(row.id),
    castingId: String(row.casting_id),
    kind: row.kind,
    status: row.status,
    generationEpoch: Number(row.generation_epoch),
    idempotencyKey: String(row.idempotency_key),
    inputSnapshotHash: String(row.input_snapshot_hash),
    attemptCount: Number(row.attempt_count),
    leaseToken: row.lease_token == null ? null : String(row.lease_token),
    leaseExpiresAt: row.lease_expires_at == null ? null : date(row.lease_expires_at),
    provider: row.provider == null ? null : String(row.provider),
    model: row.model_identifier == null ? null : String(row.model_identifier),
    structuredErrorCode: row.structured_error_code == null ? null : String(row.structured_error_code),
    createdAt: date(row.created_at),
    updatedAt: date(row.updated_at),
  };
}

function resultFromRow(row: Row): PreviewResultRecord {
  const output = previewOutputSchema.parse(row.output);
  return {
    castingId: String(row.casting_id),
    jobId: String(row.job_id),
    output,
    schemaVersion: String(row.schema_version),
    promptVersion: String(row.prompt_version),
    provider: String(row.provider),
    model: String(row.model),
    integrityHash: String(row.integrity_hash),
    persistedAt: date(row.persisted_at),
  };
}

function readingVariant(movingLinePositions: number[]): DeterministicFacts["readingVariant"] {
  if (movingLinePositions.length === 0) return "still_hexagram";
  if (movingLinePositions.length === 6) return "all_lines_moving";
  if (movingLinePositions.length > 1) return "multiple_moving";
  return "standard";
}

function contextFromRow(row: Row, questionEncryptionKeys: string | undefined): PreviewGenerationContext {
  if (!row.question_version_id || !row.result_hmac) throw new Error("PREVIEW_CONTEXT_UNAVAILABLE");
  const encrypted = {
    v: String(row.encryption_key_version),
    iv: String(row.iv),
    tag: String(row.auth_tag),
    data: String(row.ciphertext),
  };
  const castingId = String(row.casting_id);
  const aad = `${castingId}:${String(row.question_version_id)}`;
  const keyMaterial = configuredKeyMaterial(questionEncryptionKeys, encrypted.v);
  const question = keyMaterial
    ? decryptJsonWithKeyMaterial<{ context: string }>(encrypted, "context", keyMaterial, aad).context
    : decryptJson<{ context: string }>(encrypted, "context", aad).context;
  const lineValues = (row.line_values as number[]).map(Number) as DeterministicFacts["lineValuesBottomUp"];
  const movingLinePositions = (row.moving_line_positions as number[]).map(Number);
  return {
    castingId,
    userId: row.user_id == null ? null : String(row.user_id),
    lifecycle: String(row.lifecycle),
    riskStatus: row.risk_status,
    riskRuleVersion: row.risk_rule_version == null ? null : String(row.risk_rule_version),
    generationEpoch: Number(row.casting_generation_epoch ?? row.generation_epoch),
    deletedAt: row.deleted_at == null ? null : date(row.deleted_at),
    question,
    questionFingerprint: row.question_fingerprint ?? row.fingerprint,
    scene: row.scene,
    interpretationGoal: row.interpretation_goal,
    facts: {
      method: row.method ?? "three_coin",
      algorithmVersion: String(row.algorithm_version),
      classicMappingVersion: String(row.classic_mapping_version),
      lineValuesBottomUp: lineValues,
      primaryHexagramNumber: Number(row.primary_hexagram_number),
      movingLinePositions,
      relatingHexagramNumber: row.relating_hexagram_number == null ? null : Number(row.relating_hexagram_number),
      readingVariant: readingVariant(movingLinePositions),
    },
    resultHmac: String(row.result_hmac),
    resultHmacKeyVersion: String(row.result_hmac_key_version),
  };
}

export class PostgresPreviewGenerationRepository implements PreviewGenerationRepository {
  private readonly questionEncryptionKeys: string | undefined;

  constructor(private readonly sql: Sql, env: RuntimeEnv = process.env) {
    this.questionEncryptionKeys = env.QUESTION_ENCRYPTION_KEYS?.trim();
  }

  async getPreviewContext(castingId: string): Promise<PreviewGenerationContext | null> {
    const rows = await this.sql`
      select
        c.id as casting_id, c.user_id, c.lifecycle, c.risk_status, c.risk_rule_version,
        c.generation_epoch, c.scene, c.interpretation_goal, c.question_fingerprint, c.method,
        q.id as question_version_id, q.ciphertext, q.iv, q.auth_tag,
        q.encryption_key_version, q.fingerprint,
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
      where c.id = ${castingId} and c.deleted_at is null
      limit 1
    ` as Row[];
    const row = rows[0];
    if (!row || !row.question_version_id || !row.result_hmac) return null;
    return contextFromRow(row, this.questionEncryptionKeys);
  }

  async getPreview(castingId: string): Promise<PreviewResultRecord | null> {
    const rows = await this.sql`
      select casting_id, job_id, output, schema_version, prompt_version,
        provider, model, integrity_hash, persisted_at
      from preview_results where casting_id = ${castingId}
    ` as Row[];
    return rows[0] ? resultFromRow(rows[0]) : null;
  }

  async getJobStatus(castingId: string, idempotencyKey?: string): Promise<GenerationJobRecord | null> {
    const rows = idempotencyKey
      ? await this.sql`select * from generation_jobs where casting_id = ${castingId} and idempotency_key = ${idempotencyKey} order by created_at desc limit 1` as Row[]
      : await this.sql`
        select j.*
        from generation_jobs j
        left join preview_results p on p.job_id = j.id and p.casting_id = j.casting_id
        where j.casting_id = ${castingId} and j.kind = 'preview'
        order by
          case when p.job_id is not null then 2
               when j.status in ('queued', 'running') then 1
               else 0 end desc,
          j.created_at desc, j.updated_at desc, j.id desc
        limit 1
      ` as Row[];
    return rows[0] ? jobFromRow(rows[0]) : null;
  }

  async createOrReuseJob(input: CreateJobInput): Promise<{ job: GenerationJobRecord; created: boolean }> {
    return this.sql.begin(async (transaction) => {
      const now = input.now.toISOString();
      const timeoutAt = new Date(input.now.getTime() + (input.timeoutMs ?? 30_000)).toISOString();
      const existing = await transaction`
        select * from generation_jobs
        where idempotency_key = ${input.idempotencyKey}
        limit 1
      ` as Row[];
      if (existing[0]) {
        if (String(existing[0].casting_id) !== input.castingId) {
          throw new Error("GENERATION_IDEMPOTENCY_CONFLICT");
        }
        if (
          ["queued", "running", "completed"].includes(String(existing[0].status))
          && (
            Number(existing[0].generation_epoch) !== input.generationEpoch
            || String(existing[0].input_snapshot_hash) !== input.inputSnapshotHash
          )
        ) {
          throw new Error("GENERATION_IDEMPOTENCY_CONFLICT");
        }
        return { job: jobFromRow(existing[0]), created: false };
      }
      const completed = await transaction`
        select j.*
        from preview_results result
        join generation_jobs j on j.id = result.job_id
        where result.casting_id = ${input.castingId}
          and j.kind = 'preview' and j.status = 'completed'
        order by j.created_at asc
        limit 1
      ` as Row[];
      if (completed[0]) {
        const completedJob = completed[0];
        if (
          Number(completedJob.generation_epoch) === input.generationEpoch
          && String(completedJob.input_snapshot_hash) === input.inputSnapshotHash
        ) {
          return { job: jobFromRow(completedJob), created: false };
        }
        await transaction`
          delete from preview_results
          where casting_id = ${input.castingId} and job_id = ${String(completedJob.id)}
        `;
        await transaction`
          update generation_jobs
          set status = 'failed', structured_error_code = ${STALE_PREVIEW_INVALIDATED_ERROR},
              completed_at = null, updated_at = ${now}
          where id = ${String(completedJob.id)} and status = 'completed'
        `;
      }
      const active = await transaction`
        select * from generation_jobs
        where casting_id = ${input.castingId} and kind = 'preview' and status in ('queued', 'running')
        order by created_at asc
        limit 1
      ` as Row[];
      if (active[0]) return { job: jobFromRow(active[0]), created: false };
      const retryWindowStart = new Date(input.now.getTime() - PREVIEW_RETRY_BUDGET_WINDOW_MS).toISOString();
      const recentFailures = await transaction`
        select count(*)::int as count
        from generation_jobs
        where casting_id = ${input.castingId}
          and kind = 'preview'
          and status in ('failed', 'timed_out', 'dead_letter')
          and updated_at >= ${retryWindowStart}
          and structured_error_code is distinct from ${STALE_PREVIEW_INVALIDATED_ERROR}
      ` as Row[];
      if (Number(recentFailures[0]?.count ?? 0) >= PREVIEW_RETRY_BUDGET_MAX_FAILURES) {
        throw new Error("PREVIEW_RETRY_BUDGET_EXCEEDED");
      }
      const id = randomUUID();
      const inserted = await transaction`
        insert into generation_jobs (
          id, casting_id, kind, status, generation_epoch, idempotency_key,
          input_snapshot_hash, timeout_at, attempt_count, created_at, updated_at
        ) values (
          ${id}, ${input.castingId}, 'preview', 'queued', ${input.generationEpoch},
          ${input.idempotencyKey}, ${input.inputSnapshotHash}, ${timeoutAt},
          0, ${now}, ${now}
        ) on conflict do nothing returning *
      ` as Row[];
      if (inserted[0]) return { job: jobFromRow(inserted[0]), created: true };
      const raced = await transaction`
        select * from generation_jobs
        where casting_id = ${input.castingId}
          and (idempotency_key = ${input.idempotencyKey}
            or (kind = 'preview' and status in ('queued', 'running')))
        order by created_at asc limit 1
      ` as Row[];
      if (!raced[0]) throw new Error("GENERATION_JOB_UNAVAILABLE");
      return { job: jobFromRow(raced[0]), created: false };
    });
  }

  async markJobRunning(input: { jobId: string; leaseToken: string; now: Date; leaseExpiresAt: Date }): Promise<boolean> {
    const now = input.now.toISOString();
    const leaseExpiresAt = input.leaseExpiresAt.toISOString();
    return this.sql.begin(async (transaction) => {
      const rows = await transaction`
        update generation_jobs
        set status = 'running', attempt_count = attempt_count + 1,
            lease_owner = 'cp3-preview-service', lease_token = ${input.leaseToken},
            lease_expires_at = ${leaseExpiresAt}, updated_at = ${now}
        where id = ${input.jobId} and status = 'queued'
        returning id, attempt_count
      ` as Row[];
      if (rows.length !== 1) return false;
      await transaction`
        insert into generation_attempts (
          id, job_id, attempt_number, retry_classification, started_at
        ) values (
          ${randomUUID()}, ${input.jobId}, ${Number(rows[0].attempt_count)}, 'initial', ${now}
        )
      `;
      return true;
    });
  }

  async persistPreviewSuccess(input: PersistPreviewSuccessInput): Promise<PreviewResultRecord> {
    return this.sql.begin(async (transaction) => {
      const jobs = await transaction`
        select
          j.*,
          c.user_id, c.lifecycle, c.risk_status, c.risk_rule_version,
          c.generation_epoch as casting_generation_epoch, c.deleted_at,
          c.scene, c.interpretation_goal, c.question_fingerprint, c.method,
          q.id as question_version_id, q.ciphertext, q.iv, q.auth_tag,
          q.encryption_key_version, q.fingerprint,
          r.line_values, r.primary_hexagram_number, r.moving_line_positions,
          r.relating_hexagram_number, r.algorithm_version, r.classic_mapping_version,
          r.result_hmac, r.result_hmac_key_version
        from generation_jobs j
        join casting_sessions c on c.id = j.casting_id
        left join lateral (
          select * from question_versions
          where casting_id = c.id
          order by version_number desc
          limit 1
        ) q on true
        left join cast_results r on r.casting_id = c.id
        where j.id = ${input.jobId}
        for update of j, c
      ` as Row[];
      const job = jobs[0];
      if (!job) throw new Error("GENERATION_JOB_NOT_FOUND");
      if (job.status === "completed") {
        const existing = await transaction`select * from preview_results where casting_id = ${job.casting_id}` as Row[];
        if (!existing[0]) throw new Error("COMPLETED_PREVIEW_RESULT_MISSING");
        return resultFromRow(existing[0]);
      }
      const currentContext = contextFromRow(job, this.questionEncryptionKeys);
      const currentSnapshotHash = hashGenerationSnapshot({
        castingId: currentContext.castingId,
        generationEpoch: currentContext.generationEpoch,
        question: currentContext.question,
        scene: currentContext.scene,
        interpretationGoal: currentContext.interpretationGoal,
        facts: currentContext.facts,
      });
      const leaseExpiresAt = job.lease_expires_at == null ? null : date(job.lease_expires_at);
      const timeoutAt = date(job.timeout_at);
      const clockRows = await transaction`select clock_timestamp() as database_now` as Row[];
      const databaseNow = date(clockRows[0]?.database_now);
      if (
        job.status !== "running"
        || job.lease_token !== input.leaseToken
        || Number(job.generation_epoch) !== input.generationEpoch
        || Number(job.casting_generation_epoch) !== input.generationEpoch
        || currentContext.lifecycle !== "revealed"
        || currentContext.riskStatus !== "allowed"
        || currentContext.deletedAt != null
        || job.input_snapshot_hash !== input.inputSnapshotHash
        || currentSnapshotHash !== input.inputSnapshotHash
        || !leaseExpiresAt
        || leaseExpiresAt.getTime() <= databaseNow.getTime()
        || timeoutAt.getTime() <= databaseNow.getTime()
      ) {
        throw new Error("LATE_RESULT_REJECTED");
      }
      const now = databaseNow.toISOString();
      await transaction`
        insert into generation_output_reviews (
          id, job_id, casting_id, kind, status, reason_codes,
          reviewer_model_version, schema_valid, safety_pass, fact_consistency_pass, created_at
        ) values (
          ${randomUUID()}, ${input.jobId}, ${job.casting_id}, 'preview', ${input.review.status},
          ${JSON.stringify(input.review.reasonCodes)}, ${input.reviewerModelVersion},
          ${String(input.review.schemaValid)}, ${String(input.review.safetyPass)},
          ${String(input.review.factConsistencyPass)}, ${now}
        )
      `;
      const integrityHash = hashGenerationSnapshot(input.output);
      const completedUpdate = await transaction`
        update generation_jobs
        set status = 'completed', completed_at = ${now}, updated_at = ${now},
            lease_owner = null, lease_token = null, lease_expires_at = null,
            model_identifier = ${input.model}, provider_request_identifier = ${input.providerRequestId ?? null},
            token_usage = ${input.tokenUsage ? JSON.stringify(input.tokenUsage) : null},
            cost_metadata = ${input.costMetadata ? JSON.stringify(input.costMetadata) : null}
        where id = ${input.jobId} and status = 'running' and lease_token = ${input.leaseToken}
          and clock_timestamp() < timeout_at
          and clock_timestamp() < lease_expires_at
        returning id
      ` as Row[];
      if (completedUpdate.length !== 1) throw new Error("LATE_RESULT_REJECTED");
      await transaction`
        update generation_attempts
        set finished_at = ${now}, retry_classification = 'success'
        where job_id = ${input.jobId} and attempt_number = ${Number(job.attempt_count)}
      `;
      const inserted = await transaction`
        insert into preview_results (
          casting_id, job_id, output, schema_version, prompt_version,
          provider, model, integrity_hash, persisted_at
        )
        select
          ${job.casting_id}, ${input.jobId}, ${JSON.stringify(input.output)},
          ${input.output.schemaVersion}, 'commercial-preview-prompt-v1',
          ${input.provider}, ${input.model}, ${integrityHash}, ${now}
        where exists (
          select 1 from generation_jobs
          where id = ${input.jobId} and status = 'completed' and timeout_at > clock_timestamp()
        )
        returning *
      ` as Row[];
      if (!inserted[0]) throw new Error("LATE_RESULT_REJECTED");
      return resultFromRow(inserted[0]);
    });
  }

  async markJobFailed(input: {
    jobId: string;
    leaseToken: string;
    status: "failed" | "timed_out" | "dead_letter";
    errorCode: string;
    now: Date;
  }): Promise<void> {
    const now = input.now.toISOString();
    await this.sql.begin(async (transaction) => {
      const rows = await transaction`
        update generation_jobs
        set status = ${input.status}, structured_error_code = ${input.errorCode},
            lease_owner = null, lease_token = null, lease_expires_at = null, updated_at = ${now}
        where id = ${input.jobId} and status = 'running' and lease_token = ${input.leaseToken}
        returning attempt_count
      ` as Row[];
      if (rows.length !== 1) return;
      await transaction`
        update generation_attempts
        set finished_at = ${now},
            retry_classification = ${input.status === "timed_out" ? "timeout" : "failure"},
            timeout_code = ${input.status === "timed_out" ? input.errorCode : null},
            error_code = ${input.errorCode}
        where job_id = ${input.jobId} and attempt_number = ${Number(rows[0].attempt_count)}
      `;
    });
  }
}
