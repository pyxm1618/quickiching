import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { encryptJson, hmac } from "@/lib/crypto";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";
import { PostgresGenerationRepository } from "./generation-repository";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

async function seedRevealedCasting(sql: Sql, input: {
  userId: string;
  castingId: string;
  context?: string;
}) {
  const context = input.context ?? "I am deciding how to respond to repeated delays in a possible role change.";
  await sql`insert into users (id, email) values (${input.userId}, ${`${input.userId}@example.com`})`;
  await sql`
    insert into casting_sessions (
      id, user_id, method, lifecycle, risk_status, scene, interpretation_goal,
      algorithm_version, revealed_at
    ) values (
      ${input.castingId}, ${input.userId}, 'three_coin', 'revealed', 'allowed', 'career',
      'what_should_i_pay_attention_to_next', 'three-coin-v1', ${new Date("2026-07-30T00:00:00.000Z")}
    )
  `;
  const questionId = `qv_${input.castingId}`;
  const encrypted = encryptJson(
    { context },
    "context",
    undefined,
    `${input.castingId}:${questionId}`,
  );
  await sql`
    insert into question_versions (
      id, casting_session_id, version_number, ciphertext, iv, auth_tag,
      encryption_key_version, created_reason
    ) values (
      ${questionId}, ${input.castingId}, 1, ${encrypted.data}, ${encrypted.iv}, ${encrypted.tag},
      ${encrypted.v}, 'initial'
    )
  `;
  await sql`
    update casting_sessions set current_question_version_id = ${questionId}
    where id = ${input.castingId}
  `;
  const result = buildHexagramResult({
    lineValuesBottomUp: [9, 8, 7, 8, 7, 8],
    method: "three_coin",
    algorithmVersion: "three-coin-v1",
  });
  await sql`
    insert into cast_results (
      casting_session_id, line_values, primary_hexagram_number, moving_line_positions,
      relating_hexagram_number, method_calculation, result_hmac, algorithm_version,
      classic_mapping_version
    ) values (
      ${input.castingId}, ${sql.json([...result.lineValuesBottomUp])}, ${result.primaryHexagramNumber},
      ${sql.json([...result.movingLinePositions])}, ${result.relatingHexagramNumber},
      ${sql.json({ kind: "three-coin" })},
      ${hmac(JSON.stringify(result), "result")}, ${result.algorithmVersion}, ${result.classicMappingVersion}
    )
  `;
}

describePostgres("PostgresGenerationRepository", () => {
  let sql: Sql;
  let repository: PostgresGenerationRepository;
  const now = new Date("2026-07-30T00:00:00.000Z");

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 10 });
    await migratePostgres(sql);
    repository = new PostgresGenerationRepository(sql);
  });

  beforeEach(async () => {
    await resetPostgresForTests(sql);
  });

  afterAll(async () => {
    if (sql) await sql.end();
  });

  it("creates one encrypted preview job and one outbox event under concurrent enqueue", async () => {
    await seedRevealedCasting(sql, { userId: "usr_preview", castingId: "cas_preview" });

    const [first, second] = await Promise.all([
      repository.enqueuePreview({ castingId: "cas_preview", userId: "usr_preview", now }),
      repository.enqueuePreview({ castingId: "cas_preview", userId: "usr_preview", now }),
    ]);

    expect(second).toEqual(first);
    expect(await sql`select id from generation_jobs where casting_session_id = 'cas_preview'`).toHaveLength(1);
    expect(await sql`select id from outbox where aggregate_id = ${first.jobId}`).toHaveLength(1);
    const [job] = await sql`select snapshot::text as snapshot_text from generation_jobs where id = ${first.jobId}`;
    expect(job.snapshot_text).not.toContain("repeated delays");
  });

  it("allows only one worker to claim a queued job", async () => {
    await seedRevealedCasting(sql, { userId: "usr_claim", castingId: "cas_claim" });
    await repository.enqueuePreview({ castingId: "cas_claim", userId: "usr_claim", now });

    const claimed = await Promise.all([
      repository.claimNext({ workerId: "worker-a", now }),
      repository.claimNext({ workerId: "worker-b", now }),
    ]);

    expect(claimed.filter(Boolean)).toHaveLength(1);
    expect(claimed.filter((job) => job === null)).toHaveLength(1);
    expect(claimed.find(Boolean)).toMatchObject({ status: "running", generationEpoch: 1 });
  });

  it("increments the epoch for a retry and rejects a late result from the old epoch", async () => {
    await seedRevealedCasting(sql, { userId: "usr_epoch", castingId: "cas_epoch" });
    const queued = await repository.enqueuePreview({ castingId: "cas_epoch", userId: "usr_epoch", now });
    await repository.claimNext({ workerId: "worker-a", now });
    await repository.failAttempt({
      jobId: queued.jobId,
      generationEpoch: 1,
      errorCode: "AI_PROVIDER_503",
      retryable: true,
      now,
    });
    const retry = await repository.retry({ jobId: queued.jobId, now: new Date(now.getTime() + 1000) });
    expect(retry).toMatchObject({ jobId: queued.jobId, generationEpoch: 2, status: "queued" });

    const late = await repository.finalizePreview({
      jobId: queued.jobId,
      generationEpoch: 1,
      output: { relevanceStatement: "A valid but late preview that must never overwrite the current epoch." },
      providerRequestId: "provider-late",
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 100,
      now: new Date(now.getTime() + 2000),
    });
    expect(late).toEqual({ accepted: false, code: "LATE_RESULT_REJECTED" });
    const [preview] = await sql`select status, relevance_statement from previews where casting_session_id = 'cas_epoch'`;
    expect(preview).toMatchObject({ status: "queued", relevance_statement: null });
  });

  it("freezes a reading credit with the job and consumes it only in the fenced finalization transaction", async () => {
    await seedRevealedCasting(sql, { userId: "usr_reading", castingId: "cas_reading" });
    await sql`
      insert into entitlement_batches (
        id, user_id, product_id, amount_usd, quantity_total, quantity_available,
        quantity_reserved, quantity_consumed, quantity_revoked, expires_at
      ) values (
        'bat_reading', 'usr_reading', 'one', 2.99, 1, 1, 0, 0, 0,
        ${new Date("2027-07-30T00:00:00.000Z")}
      )
    `;

    const queued = await repository.enqueueDeepReading({
      castingId: "cas_reading",
      userId: "usr_reading",
      now,
    });
    const [reservedBatch] = await sql`
      select quantity_available, quantity_reserved, quantity_consumed from entitlement_batches where id = 'bat_reading'
    `;
    expect(reservedBatch).toMatchObject({ quantity_available: 0, quantity_reserved: 1, quantity_consumed: 0 });

    await repository.claimNext({ workerId: "worker-reading", now });
    const finalized = await repository.finalizeReading({
      jobId: queued.jobId,
      generationEpoch: queued.generationEpoch,
      output: { coreSummary: "validated report" },
      providerRequestId: "provider-reading",
      inputTokens: 100,
      outputTokens: 200,
      latencyMs: 500,
      now: new Date(now.getTime() + 500),
    });
    expect(finalized).toEqual({ accepted: true });

    const [batch] = await sql`
      select quantity_available, quantity_reserved, quantity_consumed, quantity_revoked
      from entitlement_batches where id = 'bat_reading'
    `;
    expect(batch).toMatchObject({ quantity_available: 0, quantity_reserved: 0, quantity_consumed: 1, quantity_revoked: 0 });
    const [reading] = await sql`select status, report from readings where casting_session_id = 'cas_reading'`;
    expect(reading).toMatchObject({ status: "completed", report: { coreSummary: "validated report" } });
  });

  it("times out stale jobs, releases an unexpired reservation, and fences later completion", async () => {
    await seedRevealedCasting(sql, { userId: "usr_timeout", castingId: "cas_timeout" });
    await sql`
      insert into entitlement_batches (
        id, user_id, product_id, amount_usd, quantity_total, quantity_available,
        quantity_reserved, quantity_consumed, quantity_revoked, expires_at
      ) values (
        'bat_timeout', 'usr_timeout', 'one', 2.99, 1, 1, 0, 0, 0,
        ${new Date("2027-07-30T00:00:00.000Z")}
      )
    `;
    const queued = await repository.enqueueDeepReading({ castingId: "cas_timeout", userId: "usr_timeout", now });
    await repository.claimNext({ workerId: "worker-timeout", now });

    const outcomes = await repository.reconcileTimeouts(new Date(now.getTime() + 6 * 60_000));
    expect(outcomes).toContainEqual({ jobId: queued.jobId, generationEpoch: 1, status: "failed" });
    const [batch] = await sql`
      select quantity_available, quantity_reserved, quantity_consumed, quantity_revoked
      from entitlement_batches where id = 'bat_timeout'
    `;
    expect(batch).toMatchObject({ quantity_available: 1, quantity_reserved: 0, quantity_consumed: 0, quantity_revoked: 0 });

    await expect(repository.finalizeReading({
      jobId: queued.jobId,
      generationEpoch: 1,
      output: { coreSummary: "late" },
      providerRequestId: "provider-late",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
      now: new Date(now.getTime() + 7 * 60_000),
    })).resolves.toEqual({ accepted: false, code: "LATE_RESULT_REJECTED" });
  });
});
