import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";
import { IntegrityCheckedPostgresGenerationRepository } from "@/server/repositories/postgres/integrity-checked-generation-repository";
import { IntegrityCheckedPostgresApplication } from "./integrity-checked-postgres-application";
import { PostgresPrivacyLifecycleService } from "./postgres-privacy-lifecycle";
import { PostgresResultIntegrityService } from "./postgres-result-integrity";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

function deterministicBits() {
  const values = [true, false, true, true, false, false, true, false, true, false, true, true];
  let index = 0;
  return () => values[index++ % values.length];
}

async function databaseNow(sql: Sql): Promise<Date> {
  const rows = await sql`select clock_timestamp() as now`;
  return rows[0].now instanceof Date ? rows[0].now : new Date(String(rows[0].now));
}

describePostgres("casting deletion generation fencing", () => {
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

  async function revealedCasting(input: {
    userId: string;
    email: string;
    anonymousSessionHash: string;
  }) {
    const integrity = new PostgresResultIntegrityService(sql);
    const application = new IntegrityCheckedPostgresApplication({
      sql,
      clock: { now: () => new Date() },
      random: { randomBit: deterministicBits(), randomInt: () => 0 },
    }, integrity);
    const draft = await application.createDraft({
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_should_i_pay_attention_to_next",
      userId: null,
      anonymousSessionHash: input.anonymousSessionHash,
    });
    await application.submitQuestion({
      castingId: draft.castingId,
      userId: null,
      anonymousSessionHash: input.anonymousSessionHash,
      context: "I need to understand how to approach a delayed role transition without forcing an outcome.",
    });
    for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
      await application.recordCoinLine({
        castingId: draft.castingId,
        userId: null,
        anonymousSessionHash: input.anonymousSessionHash,
        lineIndex: lineIndex as 0 | 1 | 2 | 3 | 4 | 5,
      });
    }
    await sql`insert into users (id, email) values (${input.userId}, ${input.email})`;
    const intent = await application.startLoginIntent({
      castingId: draft.castingId,
      anonymousSessionHash: input.anonymousSessionHash,
      allowedCallbackPath: `/result/${draft.castingId}`,
    });
    await application.consumeLoginIntentAndReveal({
      intentId: intent.intentId,
      nonce: intent.nonce,
      authenticatedUserId: input.userId,
      callbackPath: `/result/${draft.castingId}`,
    });
    return { castingId: draft.castingId, integrity };
  }

  async function grantCredit(userId: string, batchId: string) {
    const now = await databaseNow(sql);
    await sql`
      insert into entitlement_batches (
        id, user_id, product_id, amount_usd, quantity_total, quantity_available,
        quantity_reserved, quantity_consumed, quantity_revoked, expires_at,
        created_at, updated_at
      ) values (
        ${batchId}, ${userId}, 'one', 2.99, 1, 1, 0, 0, 0,
        ${new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000)}, ${now}, ${now}
      )
    `;
  }

  it("cancels a running reading, releases its credit, and rejects the old worker epoch", async () => {
    const { castingId, integrity } = await revealedCasting({
      userId: "usr_delete_generation",
      email: "delete-generation@example.com",
      anonymousSessionHash: "anon-delete-generation",
    });
    await grantCredit("usr_delete_generation", "bat_delete_generation");
    const generation = new IntegrityCheckedPostgresGenerationRepository(sql, integrity);
    const now = await databaseNow(sql);
    const queued = await generation.enqueueDeepReading({
      castingId,
      userId: "usr_delete_generation",
      now,
    });
    await generation.claimNext({ workerId: "worker-before-delete", now });

    const privacy = new PostgresPrivacyLifecycleService(sql);
    const deleted = await privacy.requestCastingDeletion({
      castingId,
      userId: "usr_delete_generation",
    });
    expect(deleted.deleted).toBe(true);
    expect(deleted.purgeAfter.getTime()).toBeGreaterThan(Date.now());

    expect((await sql`
      select lifecycle, deleted_at, purge_after from casting_sessions where id = ${castingId}
    `)[0]).toMatchObject({ lifecycle: "user_deleted" });
    expect((await sql`
      select status, generation_epoch, error_code from generation_jobs where id = ${queued.jobId}
    `)[0]).toMatchObject({
      status: "cancelled",
      generation_epoch: queued.generationEpoch + 1,
      error_code: "CASTING_DELETED",
    });
    expect((await sql`
      select status, reservation_id from readings where id = ${queued.readingId}
    `)[0]).toMatchObject({ status: "failed", reservation_id: null });
    const reservation = (await sql`
      select id, status from reservations where reading_id = ${queued.readingId}
    `)[0];
    expect(reservation.status).toBe("released");
    expect((await sql`
      select quantity_available, quantity_reserved from entitlement_batches
      where id = 'bat_delete_generation'
    `)[0]).toMatchObject({ quantity_available: 1, quantity_reserved: 0 });
    expect(await sql`
      select id from entitlement_ledger
      where reservation_id = ${reservation.id}
        and action = 'release' and reason_code = 'casting_deleted'
    `).toHaveLength(1);

    await expect(generation.finalizeReading({
      jobId: queued.jobId,
      generationEpoch: queued.generationEpoch,
      output: { coreSummary: "must not persist after deletion" },
      providerRequestId: "provider-after-delete",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
      now: new Date(0),
    })).resolves.toEqual({ accepted: false, code: "LATE_RESULT_REJECTED" });
    expect((await sql`
      select report from readings where id = ${queued.readingId}
    `)[0].report).toBeNull();
  });

  it("enforces cancellation from the database trigger even when the service layer is bypassed", async () => {
    const { castingId, integrity } = await revealedCasting({
      userId: "usr_delete_trigger",
      email: "delete-trigger@example.com",
      anonymousSessionHash: "anon-delete-trigger",
    });
    const generation = new IntegrityCheckedPostgresGenerationRepository(sql, integrity);
    const now = await databaseNow(sql);
    const queued = await generation.enqueuePreview({
      castingId,
      userId: "usr_delete_trigger",
      now,
    });
    await generation.claimNext({ workerId: "worker-trigger-delete", now });

    await sql`
      update casting_sessions set lifecycle = 'user_deleted', deleted_at = clock_timestamp(),
        purge_after = clock_timestamp() + interval '30 days', updated_at = clock_timestamp()
      where id = ${castingId} and user_id = 'usr_delete_trigger'
    `;

    expect((await sql`
      select status, generation_epoch, error_code from generation_jobs where id = ${queued.jobId}
    `)[0]).toMatchObject({
      status: "cancelled",
      generation_epoch: queued.generationEpoch + 1,
      error_code: "CASTING_DELETED",
    });
    expect((await sql`
      select status, relevance_statement from previews where casting_session_id = ${castingId}
    `)[0]).toMatchObject({ status: "failed", relevance_statement: null });
    expect((await sql`
      select status, error_code from generation_attempts where job_id = ${queued.jobId}
    `)[0]).toMatchObject({ status: "failed", error_code: "CASTING_DELETED" });
  });

  it("restores the casting without reviving cancelled jobs and permits a fresh generation epoch", async () => {
    const { castingId, integrity } = await revealedCasting({
      userId: "usr_restore_generation",
      email: "restore-generation@example.com",
      anonymousSessionHash: "anon-restore-generation",
    });
    const generation = new IntegrityCheckedPostgresGenerationRepository(sql, integrity);
    const now = await databaseNow(sql);
    const first = await generation.enqueuePreview({
      castingId,
      userId: "usr_restore_generation",
      now,
    });
    const privacy = new PostgresPrivacyLifecycleService(sql);
    await privacy.requestCastingDeletion({ castingId, userId: "usr_restore_generation" });
    await privacy.restoreCasting({ castingId, userId: "usr_restore_generation" });

    const second = await generation.enqueuePreview({
      castingId,
      userId: "usr_restore_generation",
      now: await databaseNow(sql),
    });
    expect(second.jobId).not.toBe(first.jobId);
    expect((await sql`
      select status from generation_jobs where id = ${first.jobId}
    `)[0].status).toBe("cancelled");
    expect((await sql`
      select status from generation_jobs where id = ${second.jobId}
    `)[0].status).toBe("queued");
  });
});
