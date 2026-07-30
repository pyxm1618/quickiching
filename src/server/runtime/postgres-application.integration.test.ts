import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";
import { PostgresApplicationRuntime } from "./postgres-application";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

function deterministicBits() {
  const values = [true, true, false, true, false, false, true, false, true, true, false, true];
  let index = 0;
  return () => values[index++ % values.length];
}

function deterministicYarrowSplit(maxExclusive: number): number {
  return Math.max(1, Math.floor(maxExclusive / 2));
}

describePostgres("PostgresApplicationRuntime", () => {
  let sql: Sql;
  const now = new Date("2026-07-30T00:00:00.000Z");

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

  it("persists a complete anonymous three-coin ritual, hides result fields, and reveals atomically after authentication", async () => {
    const runtime = new PostgresApplicationRuntime({
      sql,
      clock: { now: () => now },
      random: { randomBit: deterministicBits(), randomInt: () => 0 },
    });
    const draft = await runtime.createDraft({
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_should_i_pay_attention_to_next",
      userId: null,
      anonymousSessionHash: "anon-production",
    });
    await runtime.submitQuestion({
      castingId: draft.castingId,
      userId: null,
      anonymousSessionHash: "anon-production",
      context: "I am considering a role change after repeated delays and unclear expectations.",
    });

    for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
      await runtime.recordCoinLine({
        castingId: draft.castingId,
        userId: null,
        anonymousSessionHash: "anon-production",
        lineIndex: lineIndex as 0 | 1 | 2 | 3 | 4 | 5,
      });
    }

    const anonymousSnapshot = await runtime.loadCastingSnapshot({
      castingId: draft.castingId,
      userId: null,
      anonymousSessionHash: "anon-production",
      now,
    });
    expect(anonymousSnapshot).toMatchObject({
      phase: "reveal",
      progress: { completedSteps: 6, totalSteps: 6 },
      canReadResult: false,
      result: null,
    });

    await sql`insert into users (id, email) values ('usr_production', 'production@example.com')`;
    const intent = await runtime.startLoginIntent({
      castingId: draft.castingId,
      anonymousSessionHash: "anon-production",
      allowedCallbackPath: `/result/${draft.castingId}`,
    });
    const revealed = await runtime.consumeLoginIntentAndReveal({
      intentId: intent.intentId,
      nonce: intent.nonce,
      authenticatedUserId: "usr_production",
      callbackPath: `/result/${draft.castingId}`,
    });
    expect(revealed).toEqual({ revealed: true, duplicate: false, castingId: draft.castingId });

    const reloadedRuntime = new PostgresApplicationRuntime({
      sql,
      clock: { now: () => now },
      random: { randomBit: deterministicBits(), randomInt: () => 0 },
    });
    const authenticatedSnapshot = await reloadedRuntime.loadCastingSnapshot({
      castingId: draft.castingId,
      userId: "usr_production",
      anonymousSessionHash: null,
      now,
    });
    expect(authenticatedSnapshot).toMatchObject({
      phase: "result",
      canReadResult: true,
      result: {
        primaryNumber: expect.any(Number),
        algorithmVersion: "three-coin-v1",
      },
    });
    expect(authenticatedSnapshot?.result?.lineValues).toHaveLength(6);
    expect(authenticatedSnapshot?.result?.lineValues.every((value) => [6, 7, 8, 9].includes(value))).toBe(true);
  });

  it("serializes out-of-order and duplicate coin mutations at the database boundary", async () => {
    const runtime = new PostgresApplicationRuntime({
      sql,
      clock: { now: () => now },
      random: { randomBit: deterministicBits(), randomInt: () => 0 },
    });
    const draft = await runtime.createDraft({
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: null,
      anonymousSessionHash: "anon-order",
    });
    await runtime.submitQuestion({
      castingId: draft.castingId,
      userId: null,
      anonymousSessionHash: "anon-order",
      context: "I need clarity about a delayed project decision and the expectations around it.",
    });

    await expect(runtime.recordCoinLine({
      castingId: draft.castingId,
      userId: null,
      anonymousSessionHash: "anon-order",
      lineIndex: 1,
    })).rejects.toThrow("CASTING_STEP_OUT_OF_ORDER");

    const [first, replay] = await Promise.all([
      runtime.recordCoinLine({
        castingId: draft.castingId,
        userId: null,
        anonymousSessionHash: "anon-order",
        lineIndex: 0,
      }),
      runtime.recordCoinLine({
        castingId: draft.castingId,
        userId: null,
        anonymousSessionHash: "anon-order",
        lineIndex: 0,
      }),
    ]);
    expect(replay).toEqual(first);
    expect(await sql`select id from casting_steps where casting_session_id = ${draft.castingId}`).toHaveLength(1);
  });

  it("persists yarrow and current-time Mei Hua completion using the same server-authoritative lifecycle", async () => {
    const runtime = new PostgresApplicationRuntime({
      sql,
      clock: { now: () => new Date("2026-07-30T12:34:00.000Z") },
      random: { randomBit: deterministicBits(), randomInt: deterministicYarrowSplit },
    });

    const yarrow = await runtime.createDraft({
      method: "yarrow_stalk",
      scene: "personal_growth",
      interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: null,
      anonymousSessionHash: "anon-yarrow-prod",
    });
    await runtime.submitQuestion({
      castingId: yarrow.castingId,
      userId: null,
      anonymousSessionHash: "anon-yarrow-prod",
      context: "I want to understand how to approach a gradual personal change without forcing it.",
    });
    for (let index = 0; index < 18; index++) {
      await runtime.recordYarrowChange({
        castingId: yarrow.castingId,
        userId: null,
        anonymousSessionHash: "anon-yarrow-prod",
        lineIndex: Math.floor(index / 3) as 0 | 1 | 2 | 3 | 4 | 5,
        changeIndex: index % 3 as 0 | 1 | 2,
      });
    }
    await runtime.completeYarrow({
      castingId: yarrow.castingId,
      userId: null,
      anonymousSessionHash: "anon-yarrow-prod",
    });
    expect(await runtime.loadCastingSnapshot({
      castingId: yarrow.castingId,
      userId: null,
      anonymousSessionHash: "anon-yarrow-prod",
      now,
    })).toMatchObject({ phase: "reveal", progress: { completedSteps: 18, totalSteps: 18 } });

    const meiHua = await runtime.createDraft({
      method: "mei_hua_current_time",
      scene: "timing",
      interpretationGoal: "is_the_timing_favorable",
      userId: null,
      anonymousSessionHash: "anon-meihua-prod",
    });
    await runtime.submitQuestion({
      castingId: meiHua.castingId,
      userId: null,
      anonymousSessionHash: "anon-meihua-prod",
      context: "I want to reflect on the timing of beginning a new creative project this season.",
    });
    await runtime.recordMeiHua({
      castingId: meiHua.castingId,
      userId: null,
      anonymousSessionHash: "anon-meihua-prod",
      ianaTimeZone: "America/Los_Angeles",
    });
    expect(await runtime.loadCastingSnapshot({
      castingId: meiHua.castingId,
      userId: null,
      anonymousSessionHash: "anon-meihua-prod",
      now: new Date("2026-07-30T12:34:00.000Z"),
    })).toMatchObject({ phase: "reveal", progress: { completedSteps: 1, totalSteps: 1 } });
  });
});
