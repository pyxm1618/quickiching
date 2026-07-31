import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { encryptJson } from "@/lib/crypto";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";
import { PostgresResultIntegrityService } from "@/server/runtime/postgres-result-integrity";
import { PostgresGenerationRepository } from "./generation-repository";
import { IntegrityCheckedPostgresGenerationRepository } from "./integrity-checked-generation-repository";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

async function databaseNow(sql: Sql): Promise<Date> {
  const rows = await sql`select clock_timestamp() as now`;
  return rows[0].now instanceof Date ? rows[0].now : new Date(String(rows[0].now));
}

async function seedRevealedCasting(sql: Sql, input: {
  userId: string;
  castingId: string;
}) {
  const now = await databaseNow(sql);
  await sql`insert into users (id, email) values (${input.userId}, ${`${input.userId}@example.com`})`;
  await sql`
    insert into casting_sessions (
      id, user_id, method, lifecycle, risk_status, scene, interpretation_goal,
      algorithm_version, revealed_at
    ) values (
      ${input.castingId}, ${input.userId}, 'three_coin', 'revealed', 'allowed', 'career',
      'what_should_i_pay_attention_to_next', 'three-coin-v1', ${now}
    )
  `;
  const questionId = `qv_${input.castingId}`;
  const encrypted = encryptJson(
    { context: "I need to understand how to approach repeated delays without forcing an outcome." },
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
  await sql`update casting_sessions set current_question_version_id = ${questionId} where id = ${input.castingId}`;
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
      ${sql.json({ kind: "three-coin", rounds: [] })}, 'unsealed',
      ${result.algorithmVersion}, ${result.classicMappingVersion}
    )
  `;
  const integrity = new PostgresResultIntegrityService(sql);
  await integrity.seal(input.castingId);
  return integrity;
}

async function grantOneCredit(sql: Sql, userId: string, batchId: string) {
  const now = await databaseNow(sql);
  await sql`
    insert into entitlement_batches (
      id, user_id, product_id, amount_usd, quantity_total, quantity_available,
      quantity_reserved, quantity_consumed, quantity_revoked, expires_at,
      created_at, updated_at
    ) values (
      ${batchId}, ${userId}, 'one', 2.99, 1, 1, 0, 0, 0,
      ${new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)}, ${now}, ${now}
    )
  `;
}

describePostgres("generation lifecycle hardening", () => {
  let sql: Sql;

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 10 });
    await migratePostgres(sql);
  });

  beforeEach(async () => {
    await resetPostgresForTests(sql);
  });

  afterAll(async () => {
    if (sql) await sql.end();
  });

  it("atomically releases a deep-reading reservation when an attempt fails", async () => {
    const integrity = await seedRevealedCasting(sql, {
      userId: "usr_generation_failure",
      castingId: "cas_generation_failure",
    });
    await grantOneCredit(sql, "usr_generation_failure", "bat_generation_failure");
    const repository = new IntegrityCheckedPostgresGenerationRepository(sql, integrity);
    const now = await databaseNow(sql);
    const queued = await repository.enqueueDeepReading({
      castingId: "cas_generation_failure",
      userId: "usr_generation_failure",
      now,
    });
    const claimed = await repository.claimNext({ workerId: "worker-failure", now });
    expect(claimed?.id).toBe(queued.jobId);

    await expect(repository.failAttempt({
      jobId: queued.jobId,
      generationEpoch: queued.generationEpoch,
      errorCode: "AI_PROVIDER_503",
      retryable: true,
      now: new Date(0),
    })).resolves.toEqual({ accepted: true });

    expect((await sql`
      select quantity_available, quantity_reserved, quantity_consumed, quantity_revoked
      from entitlement_batches where id = 'bat_generation_failure'
    `)[0]).toMatchObject({
      quantity_available: 1,
      quantity_reserved: 0,
      quantity_consumed: 0,
      quantity_revoked: 0,
    });
    const reading = (await sql`
      select status, reservation_id from readings where casting_session_id = 'cas_generation_failure'
    `)[0];
    expect(reading).toMatchObject({ status: "failed", reservation_id: null });
    const reservation = (await sql`
      select id, status from reservations where reading_id = ${queued.readingId}
    `)[0];
    expect(reservation.status).toBe("released");
    expect(await sql`
      select id from entitlement_ledger
      where reservation_id = ${reservation.id} and action = 'release'
        and reason_code = 'generation_failure'
    `).toHaveLength(1);
  });

  it("creates a fresh reservation and reserve ledger entry for every retry epoch", async () => {
    const integrity = await seedRevealedCasting(sql, {
      userId: "usr_generation_retry",
      castingId: "cas_generation_retry",
    });
    await grantOneCredit(sql, "usr_generation_retry", "bat_generation_retry");
    const repository = new IntegrityCheckedPostgresGenerationRepository(sql, integrity);
    const now = await databaseNow(sql);
    const queued = await repository.enqueueDeepReading({
      castingId: "cas_generation_retry",
      userId: "usr_generation_retry",
      now,
    });
    await repository.claimNext({ workerId: "worker-retry", now });
    await repository.failAttempt({
      jobId: queued.jobId,
      generationEpoch: queued.generationEpoch,
      errorCode: "AI_PROVIDER_503",
      retryable: true,
      now,
    });
    const oldReservation = (await sql`
      select id from reservations where reading_id = ${queued.readingId} order by created_at asc
    `)[0].id;

    const retried = await repository.retry({ jobId: queued.jobId, now: new Date(0) });
    expect(retried).toEqual({ jobId: queued.jobId, generationEpoch: 2, status: "queued" });
    const reservations = await sql`
      select id, status from reservations where reading_id = ${queued.readingId} order by created_at asc, id asc
    `;
    expect(reservations).toHaveLength(2);
    const newReservation = reservations.find((row) => row.id !== oldReservation);
    expect(newReservation).toBeDefined();
    expect(newReservation?.status).toBe("reserved");
    expect((await repository.getJob(queued.jobId, 2))?.snapshot.reservationId).toBe(newReservation?.id);
    expect(await sql`
      select id from entitlement_ledger
      where reading_id = ${queued.readingId} and action = 'reserve'
    `).toHaveLength(2);
    expect(await sql`
      select id from entitlement_ledger
      where reservation_id = ${newReservation?.id} and reason_code = 'generation_retry'
    `).toHaveLength(1);
  });

  it("uses database time to reject a late result and releases the reservation", async () => {
    const integrity = await seedRevealedCasting(sql, {
      userId: "usr_generation_late",
      castingId: "cas_generation_late",
    });
    await grantOneCredit(sql, "usr_generation_late", "bat_generation_late");
    const repository = new IntegrityCheckedPostgresGenerationRepository(sql, integrity);
    const now = await databaseNow(sql);
    const queued = await repository.enqueueDeepReading({
      castingId: "cas_generation_late",
      userId: "usr_generation_late",
      now,
    });
    await repository.claimNext({ workerId: "worker-late", now });
    await sql`
      update generation_jobs set timeout_at = clock_timestamp() - interval '1 second'
      where id = ${queued.jobId}
    `;

    await expect(repository.finalizeReading({
      jobId: queued.jobId,
      generationEpoch: queued.generationEpoch,
      output: { coreSummary: "must not persist" },
      providerRequestId: "provider-late",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
      now: new Date(0),
    })).resolves.toEqual({ accepted: false, code: "LATE_RESULT_REJECTED" });

    expect((await sql`
      select status, error_code from generation_jobs where id = ${queued.jobId}
    `)[0]).toMatchObject({ status: "failed", error_code: "GENERATION_TIMED_OUT" });
    expect((await sql`
      select status, reservation_id, report from readings where id = ${queued.readingId}
    `)[0]).toMatchObject({ status: "failed", reservation_id: null, report: null });
    expect((await sql`
      select quantity_available, quantity_reserved, quantity_consumed
      from entitlement_batches where id = 'bat_generation_late'
    `)[0]).toMatchObject({ quantity_available: 1, quantity_reserved: 0, quantity_consumed: 0 });
  });

  it("rejects a late completion at the database boundary even through the unguarded base repository", async () => {
    const integrity = await seedRevealedCasting(sql, {
      userId: "usr_generation_trigger",
      castingId: "cas_generation_trigger",
    });
    await grantOneCredit(sql, "usr_generation_trigger", "bat_generation_trigger");
    const production = new IntegrityCheckedPostgresGenerationRepository(sql, integrity);
    const base = new PostgresGenerationRepository(sql);
    const now = await databaseNow(sql);
    const queued = await production.enqueueDeepReading({
      castingId: "cas_generation_trigger",
      userId: "usr_generation_trigger",
      now,
    });
    await production.claimNext({ workerId: "worker-trigger", now });
    await sql`
      update generation_jobs set timeout_at = clock_timestamp() - interval '1 second'
      where id = ${queued.jobId}
    `;

    await expect(base.finalizeReading({
      jobId: queued.jobId,
      generationEpoch: queued.generationEpoch,
      output: { coreSummary: "database trigger must reject" },
      providerRequestId: "provider-trigger",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
      now: new Date(0),
    })).rejects.toThrow("GENERATION_LATE_RESULT");

    expect((await sql`
      select status from generation_jobs where id = ${queued.jobId}
    `)[0].status).toBe("running");
    expect((await sql`
      select status from reservations where reading_id = ${queued.readingId}
    `)[0].status).toBe("reserved");
  });
});
