import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";
import { IntegrityCheckedPostgresApplication } from "@/server/runtime/integrity-checked-postgres-application";
import { PostgresResultIntegrityService } from "@/server/runtime/postgres-result-integrity";
import { IntegrityCheckedPostgresGenerationRepository } from "./integrity-checked-generation-repository";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

function deterministicBits() {
  const values = [true, false, true, true, false, false, true, false, true, false, true, true];
  let index = 0;
  return () => values[index++ % values.length];
}

describePostgres("generation authorization boundary", () => {
  let sql: Sql;
  const now = new Date("2026-07-31T02:00:00.000Z");

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

  it("checks casting ownership before returning an existing job or reading identifier", async () => {
    const integrity = new PostgresResultIntegrityService(sql);
    const application = new IntegrityCheckedPostgresApplication({
      sql,
      clock: { now: () => now },
      random: { randomBit: deterministicBits(), randomInt: () => 0 },
    }, integrity);
    const generation = new IntegrityCheckedPostgresGenerationRepository(sql, integrity);

    const draft = await application.createDraft({
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_should_i_pay_attention_to_next",
      userId: null,
      anonymousSessionHash: "anon-generation-owner",
    });
    await application.submitQuestion({
      castingId: draft.castingId,
      userId: null,
      anonymousSessionHash: "anon-generation-owner",
      context: "I need to understand how to approach a delayed role transition without forcing an outcome.",
    });
    for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
      await application.recordCoinLine({
        castingId: draft.castingId,
        userId: null,
        anonymousSessionHash: "anon-generation-owner",
        lineIndex: lineIndex as 0 | 1 | 2 | 3 | 4 | 5,
      });
    }
    await sql`insert into users (id, email) values
      ('usr_generation_owner', 'owner@example.com'),
      ('usr_generation_attacker', 'attacker@example.com')`;
    const intent = await application.startLoginIntent({
      castingId: draft.castingId,
      anonymousSessionHash: "anon-generation-owner",
      allowedCallbackPath: `/result/${draft.castingId}`,
    });
    await application.consumeLoginIntentAndReveal({
      intentId: intent.intentId,
      nonce: intent.nonce,
      authenticatedUserId: "usr_generation_owner",
      callbackPath: `/result/${draft.castingId}`,
    });

    const ownerJob = await generation.enqueuePreview({
      castingId: draft.castingId,
      userId: "usr_generation_owner",
      now,
    });
    expect(ownerJob.jobId).toMatch(/^job_/);

    await expect(generation.enqueuePreview({
      castingId: draft.castingId,
      userId: "usr_generation_attacker",
      now,
    })).rejects.toThrow("CASTING_NOT_FOUND");

    const jobs = await sql`
      select id, reading_id, status from generation_jobs
      where casting_session_id = ${draft.castingId}
    `;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: ownerJob.jobId, reading_id: null, status: "queued" });
  });
});
