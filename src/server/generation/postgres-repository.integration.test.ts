import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { encryptJsonWithKeyMaterial } from "@/lib/crypto";
import { resultIntegrityHmac } from "./integrity";
import { hashGenerationSnapshot } from "./boundary";
import { PreviewGenerationService } from "./preview-service";
import { PostgresPreviewGenerationRepository } from "./postgres-repository";
import type { OutputReviewer, PreviewProvider } from "./types";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");

const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql);

async function databaseNow(): Promise<Date> {
  const rows = await sql<{ database_now: Date }[]>`select clock_timestamp() as database_now`;
  return new Date(rows[0]!.database_now);
}

async function seedMinimalCasting(label: string): Promise<{ castingId: string; userId: string }> {
  const suffix = randomUUID();
  const userId = `cp3-${label}-${suffix}`;
  const castingId = randomUUID();
  await sql`
    insert into users (id, name, email, email_verified)
    values (${userId}, ${`CP3 ${label}`}, ${`${label}-${suffix}@example.com`}, true)
  `;
  await sql`
    insert into casting_sessions (
      id, user_id, method, lifecycle, risk_status, scene, interpretation_goal, generation_epoch
    ) values (
      ${castingId}, ${userId}, 'three_coin', 'revealed', 'allowed', 'career',
      'what_do_i_need_to_see_clearly', 0
    )
  `;
  return { castingId, userId };
}

describe("CP3 PostgreSQL Preview repository", () => {
  beforeAll(async () => {
    vi.stubEnv("APP_SECRET", "cp3-postgres-integration-secret");
    vi.stubEnv("QUESTION_ENCRYPTION_KEYS", "v1:cp3-question-encryption-key");
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await sql.end({ timeout: 5 });
  });

  it("persists a reviewed Preview atomically and reuses the same idempotency job", async () => {
    const suffix = randomUUID();
    const userId = `cp3-repository-${suffix}`;
    const castingId = randomUUID();
    const questionVersionId = randomUUID();
    const currentRows = await sql<{ database_now: Date }[]>`select clock_timestamp() as database_now`;
    const now = new Date(currentRows[0]!.database_now);
    const facts = {
      method: "three_coin" as const,
      algorithmVersion: "three-coin-v1",
      classicMappingVersion: "king-wen-v1",
      lineValuesBottomUp: [7, 9, 8, 7, 6, 7] as [7, 9, 8, 7, 6, 7],
      primaryHexagramNumber: 1,
      movingLinePositions: [2, 5],
      relatingHexagramNumber: 44,
      readingVariant: "multiple_moving" as const,
    };
    const question = "How can I approach my work decision with greater clarity?";
    const encrypted = encryptJsonWithKeyMaterial(
      { context: question },
      "context",
      "v1",
      "cp3-question-encryption-key",
      `${castingId}:${questionVersionId}`,
    );
    const resultHmac = resultIntegrityHmac(facts, { version: "v1", material: "cp3-result-key" });

    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (${userId}, 'CP3 Repository', ${`${suffix}@example.com`}, true, ${now.toISOString()}, ${now.toISOString()})
    `;
    await sql`
      insert into casting_sessions (
        id, user_id, method, lifecycle, risk_status, risk_rule_version, scene,
        interpretation_goal, question_fingerprint, fingerprint_key_version,
        generation_epoch, created_at, updated_at
      ) values (
        ${castingId}, ${userId}, 'three_coin', 'revealed', 'allowed', 'risk-v2', 'career',
        'what_do_i_need_to_see_clearly', 'question-fingerprint', 'v1', 3,
        ${now.toISOString()}, ${now.toISOString()}
      )
    `;
    await sql`
      insert into question_versions (
        id, casting_id, version_number, ciphertext, iv, auth_tag,
        encryption_key_version, fingerprint_key_version, fingerprint, created_reason, created_at
      ) values (
        ${questionVersionId}, ${castingId}, 1, ${encrypted.data}, ${encrypted.iv}, ${encrypted.tag},
        ${encrypted.v}, 'v1', 'question-fingerprint', 'initial', ${now.toISOString()}
      )
    `;
    await sql`
      insert into cast_results (
        casting_id, line_values, primary_hexagram_number, moving_line_positions,
        relating_hexagram_number, method_calculation, algorithm_version,
        classic_mapping_version, result_hmac, result_hmac_key_version, created_at
      ) values (
        ${castingId}, ${facts.lineValuesBottomUp}, ${facts.primaryHexagramNumber}, ${facts.movingLinePositions},
        ${facts.relatingHexagramNumber}, ${JSON.stringify({ kind: "three-coin", version: "three-coin-v1" })},
        ${facts.algorithmVersion}, ${facts.classicMappingVersion}, ${resultHmac}, 'v1', ${now.toISOString()}
      )
    `;

    const repository = new PostgresPreviewGenerationRepository(sql);
    const orphanedJob = await repository.createOrReuseJob({
      castingId,
      userId,
      kind: "preview",
      generationEpoch: 3,
      idempotencyKey: "preview-orphaned-before-claim",
      inputSnapshotHash: hashGenerationSnapshot({
        castingId,
        userId,
        generationEpoch: 3,
        question,
        scene: "career",
        interpretationGoal: "what_do_i_need_to_see_clearly",
        facts,
      }),
      timeoutMs: 30_000,
      now,
    });
    expect(orphanedJob.created).toBe(true);
    const providerCalls: string[] = [];
    const provider: PreviewProvider = {
      provider: "test-provider",
      model: "test-preview-model",
      async generatePreview(input) {
        providerCalls.push(input.question);
        return {
          output: {
            schemaVersion: "commercial-preview-v1" as const,
            relevanceStatement: "The situation calls for a bounded look at timing and choice.",
            surfaceThemes: ["Timing", "Choice"],
            boundary: "This Preview is a surface reflection, not a complete reading or certainty.",
            disclaimer: "For reflection only; it is not professional advice.",
          },
          deterministicFacts: input.facts,
          requestId: "test-request-1",
          tokenUsage: { input: 100, output: 80, total: 180 },
        };
      },
      async generateReading() {
        throw new Error("DEEP_READING_NOT_CONFIGURED");
      },
    };
    const reviewer: OutputReviewer = {
      reviewerModel: "test-reviewer-v1",
      async review() {
        return {
          status: "pass" as const,
          reasonCodes: ["schema_and_safety_pass"],
          schemaValid: true,
          safetyPass: true,
          factConsistencyPass: true,
        };
      },
    };
    const service = new PreviewGenerationService({
      repository,
      provider,
      reviewer,
      now: () => now,
      verifyResultIntegrity: () => true,
    });

    const first = await service.generate({
      castingId,
      userId,
      idempotencyKey: "preview-idempotency-1",
    });
    expect(first.status).toBe("completed");
    expect(first.jobId).toBe(orphanedJob.job.id);
    expect(first.result?.output.schemaVersion).toBe("commercial-preview-v1");
    expect(providerCalls).toEqual([question]);

    const second = await service.generate({
      castingId,
      userId,
      idempotencyKey: "preview-idempotency-1",
    });
    expect(second).toMatchObject({ status: "completed", jobId: first.jobId });
    expect(providerCalls).toEqual([question]);

    const third = await service.generate({
      castingId,
      userId,
      idempotencyKey: "preview-idempotency-new-key",
    });
    expect(third).toMatchObject({ status: "completed", jobId: first.jobId });
    expect(providerCalls).toEqual([question]);

    await sql`
      update casting_sessions
      set generation_epoch = 4, updated_at = ${now.toISOString()}
      where id = ${castingId}
    `;
    const fourth = await service.generate({
      castingId,
      userId,
      idempotencyKey: "preview-idempotency-after-epoch-change",
    });
    expect(fourth.status).toBe("completed");
    expect(fourth.jobId).not.toBe(first.jobId);
    expect(providerCalls).toEqual([question, question]);

    const storedJob = await repository.getJobStatus(castingId, "preview-orphaned-before-claim");
    expect(storedJob).toMatchObject({
      status: "failed",
      attemptCount: 1,
      model: "test-preview-model",
      leaseToken: null,
    });
    const storedPreview = await repository.getPreview(castingId);
    expect(storedPreview).toMatchObject({ jobId: fourth.jobId, provider: "test-provider" });

    const replacementOwnerId = `cp3-completed-owner-${suffix}`;
    await sql`
      insert into users (id, name, email, email_verified)
      values (${replacementOwnerId}, 'CP3 Completed Owner', ${`completed-owner-${suffix}@example.com`}, true)
    `;
    await sql`update casting_sessions set user_id = ${replacementOwnerId} where id = ${castingId}`;
    await expect(repository.persistPreviewSuccess({
      jobId: fourth.jobId,
      leaseToken: "already-completed-lease",
      userId,
      generationEpoch: 4,
      inputSnapshotHash: hashGenerationSnapshot({
        castingId,
        userId,
        generationEpoch: 4,
        question,
        scene: "career",
        interpretationGoal: "what_do_i_need_to_see_clearly",
        facts,
      }),
      output: storedPreview!.output,
      review: {
        status: "pass",
        reasonCodes: [],
        schemaValid: true,
        safetyPass: true,
        factConsistencyPass: true,
      },
      provider: "test-provider",
      model: "test-preview-model",
      reviewerModelVersion: "test-reviewer-v1",
      now,
    })).rejects.toThrow("LATE_RESULT_REJECTED");
    await sql`update casting_sessions set user_id = ${userId} where id = ${castingId}`;

    const rows = await sql<{ review_status: string; reviewer_model_version: string; job_status: string }[]>`
      select r.status as review_status, r.reviewer_model_version, j.status as job_status
      from generation_output_reviews r
      join generation_jobs j on j.id = r.job_id
      where j.casting_id = ${castingId}
    `;
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(expect.arrayContaining([
      {
        review_status: "pass",
        reviewer_model_version: "test-reviewer-v1",
        job_status: "failed",
      },
      {
        review_status: "pass",
        reviewer_model_version: "test-reviewer-v1",
        job_status: "completed",
      },
    ]));

    const attempts = await sql<{ attempt_number: number; retry_classification: string; finished_at: Date | null }[]>`
      select attempt_number, retry_classification, finished_at
      from generation_attempts
      where job_id = ${first.jobId}
    `;
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ attempt_number: 1, retry_classification: "success" });
    expect(attempts[0]?.finished_at).not.toBeNull();

    const rollbackJobId = randomUUID();
    const rollbackLease = "rollback-lease";
    const rollbackSnapshotHash = hashGenerationSnapshot({
      castingId,
      userId,
      generationEpoch: 4,
      question,
      scene: "career",
      interpretationGoal: "what_do_i_need_to_see_clearly",
      facts,
    });
    await sql`delete from preview_results where casting_id = ${castingId}`;
    const clockRows = await sql<{ database_now: Date }[]>`select clock_timestamp() as database_now`;
    const lockNow = new Date(clockRows[0]!.database_now);
    await sql`
      insert into generation_jobs (
        id, casting_id, kind, status, generation_epoch, idempotency_key,
        input_snapshot_hash, timeout_at, attempt_count, lease_owner, lease_token,
        lease_expires_at, created_at, updated_at
      ) values (
        ${rollbackJobId}, ${castingId}, 'preview', 'running', 4, 'rollback-request',
        ${rollbackSnapshotHash}, ${new Date(lockNow.getTime() + 100).toISOString()}, 1,
        'test', ${rollbackLease}, ${new Date(lockNow.getTime() + 100).toISOString()},
        ${lockNow.toISOString()}, ${lockNow.toISOString()}
      )
    `;
    await sql`
      insert into generation_attempts (id, job_id, attempt_number, retry_classification, started_at)
      values (${randomUUID()}, ${rollbackJobId}, 1, 'initial', ${lockNow.toISOString()})
    `;
    let releaseLock!: () => void;
    let lockReady!: () => void;
    const lockReleased = new Promise<void>((resolve) => { releaseLock = resolve; });
    const rowLocked = new Promise<void>((resolve) => { lockReady = resolve; });
    const lockTransaction = sql.begin(async (transaction) => {
      await transaction`select id from generation_jobs where id = ${rollbackJobId} for update`;
      lockReady();
      await lockReleased;
    });
    await rowLocked;
    const pendingPersist = repository.persistPreviewSuccess({
      jobId: rollbackJobId,
      leaseToken: rollbackLease,
      userId,
      generationEpoch: 4,
      inputSnapshotHash: rollbackSnapshotHash,
      output: storedPreview!.output,
      review: {
        status: "pass",
        reasonCodes: [],
        schemaValid: true,
        safetyPass: true,
        factConsistencyPass: true,
      },
      provider: "test-provider",
      model: "test-preview-model",
      reviewerModelVersion: "test-reviewer-v1",
      now: lockNow,
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    releaseLock();
    await expect(pendingPersist).rejects.toThrow("LATE_RESULT_REJECTED");
    await lockTransaction;
    const rollbackState = await sql<{ job_status: string; review_count: string; finished_at: Date | null }[]>`
      select j.status as job_status,
        (select count(*)::text from generation_output_reviews r where r.job_id = j.id) as review_count,
        a.finished_at
      from generation_jobs j
      join generation_attempts a on a.job_id = j.id and a.attempt_number = 1
      where j.id = ${rollbackJobId}
    `;
    expect(rollbackState[0]).toMatchObject({ job_status: "running", review_count: "0", finished_at: null });

    const plaintextColumns = await sql<{ question: string | null; context: string | null }[]>`
      select nullif(to_jsonb(q)->>'question', '') as question,
             nullif(to_jsonb(q)->>'context', '') as context
      from question_versions q
      where q.casting_id = ${castingId}
    `;
    expect(plaintextColumns[0]).toEqual({ question: null, context: null });

    await expect(sql`delete from casting_sessions where id = ${castingId}`).resolves.toBeDefined();
    const deletedRows = await sql<{ count: string }[]>`
      select (
        (select count(*) from question_versions where casting_id = ${castingId})
        + (select count(*) from cast_results where casting_id = ${castingId})
        + (select count(*) from generation_jobs where casting_id = ${castingId})
        + (select count(*) from preview_results where casting_id = ${castingId})
      )::text as count
    `;
    expect(deletedRows[0]?.count).toBe("0");
  });

  it("serializes concurrent creation of the same active idempotent job in PostgreSQL", async () => {
    const suffix = randomUUID();
    const userId = `cp3-concurrent-${suffix}`;
    const castingId = randomUUID();
    const now = new Date("2026-08-24T00:01:00.000Z");
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (${userId}, 'CP3 Concurrent', ${`${suffix}@example.com`}, true, ${now.toISOString()}, ${now.toISOString()})
    `;
    await sql`
      insert into casting_sessions (
        id, user_id, method, lifecycle, risk_status, scene, interpretation_goal,
        generation_epoch, created_at, updated_at
      ) values (
        ${castingId}, ${userId}, 'three_coin', 'revealed', 'allowed', 'career',
        'what_do_i_need_to_see_clearly', 0, ${now.toISOString()}, ${now.toISOString()}
      )
    `;

    const repository = new PostgresPreviewGenerationRepository(sql);
    const results = await Promise.all(Array.from({ length: 4 }, () => repository.createOrReuseJob({
      castingId,
      userId,
      kind: "preview",
      generationEpoch: 0,
      idempotencyKey: "same-concurrent-request",
      inputSnapshotHash: "same-snapshot",
      now,
    })));

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.job.id)).size).toBe(1);
    const jobs = await sql<{ count: string }[]>`
      select count(*)::text as count
      from generation_jobs
      where casting_id = ${castingId} and kind = 'preview'
    `;
    expect(jobs[0]?.count).toBe("1");

    const otherCastingId = randomUUID();
    await sql`
      insert into casting_sessions (
        id, user_id, method, lifecycle, risk_status, scene, interpretation_goal,
        generation_epoch, created_at, updated_at
      ) values (
        ${otherCastingId}, ${userId}, 'three_coin', 'revealed', 'allowed', 'career',
        'what_do_i_need_to_see_clearly', 0, ${now.toISOString()}, ${now.toISOString()}
      )
    `;
    await expect(repository.createOrReuseJob({
      castingId: otherCastingId,
      userId,
      kind: "preview",
      generationEpoch: 0,
      idempotencyKey: "same-concurrent-request",
      inputSnapshotHash: "other-snapshot",
      now,
    })).rejects.toThrow("GENERATION_IDEMPOTENCY_CONFLICT");

    await sql`
      update generation_jobs
      set status = 'failed', structured_error_code = 'provider_error', updated_at = clock_timestamp()
      where casting_id = ${castingId} and idempotency_key = 'same-concurrent-request'
    `;
    for (const index of [1, 2]) {
      await sql`
        insert into generation_jobs (
          id, casting_id, kind, status, generation_epoch, idempotency_key,
          input_snapshot_hash, timeout_at, created_at, updated_at, structured_error_code
        ) values (
          ${randomUUID()}, ${castingId}, 'preview', 'failed', 0, ${`failed-budget-${index}`},
          ${`failed-snapshot-${index}`}, clock_timestamp() + interval '30 seconds',
          clock_timestamp(), clock_timestamp(), 'provider_error'
        )
      `;
    }
    await expect(new PostgresPreviewGenerationRepository(sql).createOrReuseJob({
      castingId,
      userId,
      kind: "preview",
      generationEpoch: 0,
      idempotencyKey: "failed-budget-new-key",
      inputSnapshotHash: "new-snapshot",
      now,
    })).rejects.toThrow("PREVIEW_RETRY_BUDGET_EXCEEDED");
  });

  it("uses the PostgreSQL clock for job deadlines and leases", async () => {
    const { castingId, userId } = await seedMinimalCasting("database-clock");
    const repository = new PostgresPreviewGenerationRepository(sql);
    const before = await databaseNow();
    const created = await repository.createOrReuseJob({
      castingId,
      userId,
      kind: "preview",
      generationEpoch: 0,
      idempotencyKey: `database-clock-${randomUUID()}`,
      inputSnapshotHash: "database-clock-snapshot",
      timeoutMs: 30_000,
      now: new Date("2100-01-01T00:00:00.000Z"),
    });
    const after = await databaseNow();
    expect(created.job.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(created.job.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());

    await expect(repository.markJobRunning({
      jobId: created.job.id,
      leaseToken: "database-clock-lease",
      now: new Date("2000-01-01T00:00:00.000Z"),
      leaseDurationMs: 30_000,
    })).resolves.toBe(true);
    const leaseRows = await sql<{ lease_expires_at: Date; database_now: Date }[]>`
      select lease_expires_at, clock_timestamp() as database_now
      from generation_jobs where id = ${created.job.id}
    `;
    expect(new Date(leaseRows[0]!.lease_expires_at).getTime())
      .toBeGreaterThan(new Date(leaseRows[0]!.database_now).getTime());
  });

  it("uses the PostgreSQL clock for the durable retry window", async () => {
    const { castingId, userId } = await seedMinimalCasting("retry-clock");
    for (const index of [1, 2, 3]) {
      await sql`
        insert into generation_jobs (
          id, casting_id, kind, status, generation_epoch, idempotency_key,
          input_snapshot_hash, timeout_at, updated_at, structured_error_code
        ) values (
          ${randomUUID()}, ${castingId}, 'preview', 'failed', 0, ${`retry-clock-${index}-${randomUUID()}`},
          ${`retry-clock-snapshot-${index}`}, clock_timestamp() + interval '30 seconds',
          clock_timestamp(), 'provider_error'
        )
      `;
    }

    await expect(new PostgresPreviewGenerationRepository(sql).createOrReuseJob({
      castingId,
      userId,
      kind: "preview",
      generationEpoch: 0,
      idempotencyKey: `retry-clock-new-${randomUUID()}`,
      inputSnapshotHash: "retry-clock-new-snapshot",
      now: new Date("2100-01-01T00:00:00.000Z"),
    })).rejects.toThrow("PREVIEW_RETRY_BUDGET_EXCEEDED");
  });

  it("keeps a job kind immutable after a matching review exists", async () => {
    const { castingId } = await seedMinimalCasting("review-kind");
    const jobId = randomUUID();
    await sql`
      insert into generation_jobs (
        id, casting_id, kind, status, generation_epoch, idempotency_key,
        input_snapshot_hash, timeout_at, structured_error_code
      ) values (
        ${jobId}, ${castingId}, 'preview', 'failed', 0, ${`review-kind-${randomUUID()}`},
        'review-kind-snapshot', clock_timestamp() + interval '30 seconds', 'provider_error'
      )
    `;
    await sql`
      insert into generation_output_reviews (
        id, job_id, casting_id, kind, status, reason_codes, reviewer_model_version,
        schema_valid, safety_pass, fact_consistency_pass
      ) values (
        ${randomUUID()}, ${jobId}, ${castingId}, 'preview', 'pass', '[]'::jsonb, 'review-kind-v1',
        'true', 'true', 'true'
      )
    `;

    await expect(sql`update generation_jobs set kind = 'deep_reading' where id = ${jobId}`)
      .rejects.toThrow("IMMUTABLE_GENERATION_JOB_IDENTITY");
  });

  it.each(["epoch", "deleted", "lifecycle", "owner"] as const)(
    "rejects a provider result after PostgreSQL observes a changed %s identity fence",
    async (mutation) => {
    const suffix = randomUUID();
    const userId = `cp3-stale-${suffix}`;
    const castingId = randomUUID();
    const questionVersionId = randomUUID();
    const now = await databaseNow();
    const facts = {
      method: "three_coin" as const,
      algorithmVersion: "three-coin-v1",
      classicMappingVersion: "king-wen-v1",
      lineValuesBottomUp: [7, 9, 8, 7, 6, 7] as [7, 9, 8, 7, 6, 7],
      primaryHexagramNumber: 1,
      movingLinePositions: [2, 5],
      relatingHexagramNumber: 44,
      readingVariant: "multiple_moving" as const,
    };
    const question = "What should I notice before changing direction at work?";
    const encrypted = encryptJsonWithKeyMaterial(
      { context: question },
      "context",
      "v1",
      "cp3-question-encryption-key",
      `${castingId}:${questionVersionId}`,
    );
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (${userId}, 'CP3 Stale', ${`${suffix}@example.com`}, true, ${now.toISOString()}, ${now.toISOString()})
    `;
    await sql`
      insert into casting_sessions (
        id, user_id, method, lifecycle, risk_status, risk_rule_version, scene,
        interpretation_goal, question_fingerprint, fingerprint_key_version,
        generation_epoch, created_at, updated_at
      ) values (
        ${castingId}, ${userId}, 'three_coin', 'revealed', 'allowed', 'risk-v2', 'career',
        'what_do_i_need_to_see_clearly', 'stale-question', 'v1', 1,
        ${now.toISOString()}, ${now.toISOString()}
      )
    `;
    await sql`
      insert into question_versions (
        id, casting_id, version_number, ciphertext, iv, auth_tag,
        encryption_key_version, fingerprint_key_version, fingerprint, created_reason, created_at
      ) values (
        ${questionVersionId}, ${castingId}, 1, ${encrypted.data}, ${encrypted.iv}, ${encrypted.tag},
        ${encrypted.v}, 'v1', 'stale-question', 'initial', ${now.toISOString()}
      )
    `;
    await sql`
      insert into cast_results (
        casting_id, line_values, primary_hexagram_number, moving_line_positions,
        relating_hexagram_number, method_calculation, algorithm_version,
        classic_mapping_version, result_hmac, result_hmac_key_version, created_at
      ) values (
        ${castingId}, ${facts.lineValuesBottomUp}, ${facts.primaryHexagramNumber}, ${facts.movingLinePositions},
        ${facts.relatingHexagramNumber}, ${JSON.stringify({ kind: "three-coin", version: "three-coin-v1" })},
        ${facts.algorithmVersion}, ${facts.classicMappingVersion},
        ${resultIntegrityHmac(facts, { version: "v1", material: "cp3-result-key" })}, 'v1', ${now.toISOString()}
      )
    `;

    let releaseProvider!: () => void;
    let providerEntered!: () => void;
    const providerGate = new Promise<void>((resolve) => { releaseProvider = resolve; });
    const providerStarted = new Promise<void>((resolve) => { providerEntered = resolve; });
    const provider: PreviewProvider = {
      provider: "stale-provider",
      model: "stale-model",
      async generatePreview(input) {
        providerEntered();
        await providerGate;
        return {
          output: {
            schemaVersion: "commercial-preview-v1" as const,
            relevanceStatement: "A bounded reflection remains possible.",
            surfaceThemes: ["direction"],
            boundary: "This is not a prediction or instruction.",
            disclaimer: "For reflection only; it is not professional advice.",
          },
          deterministicFacts: input.facts,
        };
      },
      async generateReading() {
        throw new Error("DEEP_READING_NOT_CONFIGURED");
      },
    };
    const reviewer: OutputReviewer = {
      reviewerModel: "stale-reviewer",
      async review() {
        return { status: "pass", reasonCodes: [], schemaValid: true, safetyPass: true, factConsistencyPass: true };
      },
    };
    const repository = new PostgresPreviewGenerationRepository(sql);
    const service = new PreviewGenerationService({
      repository,
      provider,
      reviewer,
      now: () => now,
      verifyResultIntegrity: () => true,
    });
    const pending = service.generate({ castingId, userId, idempotencyKey: `stale-request-${suffix}` });
    await providerStarted;
    if (mutation === "epoch") {
      await sql`update casting_sessions set generation_epoch = 2, updated_at = clock_timestamp() where id = ${castingId}`;
    } else if (mutation === "deleted") {
      await sql`update casting_sessions set deleted_at = clock_timestamp(), updated_at = clock_timestamp() where id = ${castingId}`;
    } else if (mutation === "lifecycle") {
      await sql`update casting_sessions set lifecycle = 'user_deleted', updated_at = clock_timestamp() where id = ${castingId}`;
    } else {
      const newOwnerId = `cp3-new-owner-${suffix}`;
      await sql`
        insert into users (id, name, email, email_verified)
        values (${newOwnerId}, 'CP3 New Owner', ${`new-owner-${suffix}@example.com`}, true)
      `;
      await sql`update casting_sessions set user_id = ${newOwnerId}, updated_at = clock_timestamp() where id = ${castingId}`;
    }
    releaseProvider();

    await expect(pending).rejects.toThrow("PERSISTENCE_FAILED");
    await expect(repository.getPreview(castingId)).resolves.toBeNull();
    await expect(repository.getJobStatus(castingId)).resolves.toMatchObject({ status: "failed" });
    },
  );
});
