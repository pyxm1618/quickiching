import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";
import { IntegrityCheckedPostgresGenerationRepository } from "@/server/repositories/postgres/integrity-checked-generation-repository";
import { IntegrityCheckedPostgresApplication } from "./integrity-checked-postgres-application";
import { PostgresApplicationRuntime } from "./postgres-application";
import { PostgresResultIntegrityService } from "./postgres-result-integrity";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

function deterministicBits() {
  const values = [true, true, false, true, false, false, true, false, true, true, false, true];
  let index = 0;
  return () => values[index++ % values.length];
}

describePostgres("PostgreSQL cast result integrity", () => {
  let sql: Sql;
  const now = new Date("2026-07-31T01:00:00.000Z");

  function dependencies() {
    return {
      sql,
      clock: { now: () => now },
      random: { randomBit: deterministicBits(), randomInt: () => 0 },
    };
  }

  async function completeCasting(application: PostgresApplicationRuntime, owner: string) {
    const draft = await application.createDraft({
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_should_i_pay_attention_to_next",
      userId: null,
      anonymousSessionHash: owner,
    });
    await application.submitQuestion({
      castingId: draft.castingId,
      userId: null,
      anonymousSessionHash: owner,
      context: "I need to understand how to approach a delayed professional transition with clear boundaries.",
    });
    for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
      await application.recordCoinLine({
        castingId: draft.castingId,
        userId: null,
        anonymousSessionHash: owner,
        lineIndex: lineIndex as 0 | 1 | 2 | 3 | 4 | 5,
      });
    }
    return draft.castingId;
  }

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

  it("seals completed production results with a key version and supports idempotent final-step replay", async () => {
    const integrity = new PostgresResultIntegrityService(sql);
    const application = new IntegrityCheckedPostgresApplication(dependencies(), integrity);
    const castingId = await completeCasting(application, "anon-integrity");

    const rows = await sql`
      select result_hmac, result_hmac_key_version from cast_results
      where casting_session_id = ${castingId}
    `;
    expect(rows[0].result_hmac).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(rows[0].result_hmac_key_version).toBe("v1");

    await expect(application.recordCoinLine({
      castingId,
      userId: null,
      anonymousSessionHash: "anon-integrity",
      lineIndex: 5,
    })).resolves.toEqual({ lineIndex: 5, completed: true });
    await expect(integrity.assertValid(castingId)).resolves.toBeUndefined();
  });

  it("makes sealed result evidence immutable at the database boundary", async () => {
    const integrity = new PostgresResultIntegrityService(sql);
    const application = new IntegrityCheckedPostgresApplication(dependencies(), integrity);
    const castingId = await completeCasting(application, "anon-immutable");

    await expect(sql`
      update cast_results set primary_hexagram_number = 1
      where casting_session_id = ${castingId}
    `).rejects.toThrow("CAST_RESULT_IMMUTABLE");
    await expect(sql`
      update cast_results set method_calculation = ${sql.json({ forged: true } as never)}
      where casting_session_id = ${castingId}
    `).rejects.toThrow("CAST_RESULT_IMMUTABLE");
  });

  it("rejects corrupted HMACs before result display and before generation metadata is created", async () => {
    const integrity = new PostgresResultIntegrityService(sql);
    const application = new IntegrityCheckedPostgresApplication(dependencies(), integrity);
    const generation = new IntegrityCheckedPostgresGenerationRepository(sql, integrity);
    const castingId = await completeCasting(application, "anon-corrupt");
    await sql`insert into users (id, email) values ('usr_integrity', 'integrity@example.com')`;
    const intent = await application.startLoginIntent({
      castingId,
      anonymousSessionHash: "anon-corrupt",
      allowedCallbackPath: `/result/${castingId}`,
    });
    await application.consumeLoginIntentAndReveal({
      intentId: intent.intentId,
      nonce: intent.nonce,
      authenticatedUserId: "usr_integrity",
      callbackPath: `/result/${castingId}`,
    });

    await sql.unsafe("alter table cast_results disable trigger cast_results_immutable_trigger");
    await sql`update cast_results set result_hmac = 'forged' where casting_session_id = ${castingId}`;
    await sql.unsafe("alter table cast_results enable trigger cast_results_immutable_trigger");

    await expect(application.loadCastingSnapshot({
      castingId,
      userId: "usr_integrity",
      anonymousSessionHash: null,
      now,
    })).rejects.toThrow("CAST_RESULT_INTEGRITY_FAILED");
    await expect(generation.enqueuePreview({
      castingId,
      userId: "usr_integrity",
      now,
    })).rejects.toThrow("CAST_RESULT_INTEGRITY_FAILED");
    expect(await sql`select id from generation_jobs where casting_session_id = ${castingId}`).toHaveLength(0);
  });

  it("rejects legacy or partially written results that have no HMAC key version", async () => {
    const raw = new PostgresApplicationRuntime(dependencies());
    const integrity = new PostgresResultIntegrityService(sql);
    const castingId = await completeCasting(raw, "anon-unsealed");

    await expect(integrity.assertValid(castingId)).rejects.toThrow("CAST_RESULT_INTEGRITY_FAILED");
  });
});
