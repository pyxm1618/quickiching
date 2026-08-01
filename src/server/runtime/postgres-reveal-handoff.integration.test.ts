import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";
import { PostgresApplicationRuntime } from "./postgres-application";
import { PostgresRevealHandoffService } from "./postgres-reveal-handoff";
import { PostgresAuthenticatedRevealService } from "./postgres-authenticated-reveal";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

function deterministicBits() {
  const values = [true, false, true, true, false, false, true, false, true, false, true, true];
  let index = 0;
  return () => values[index++ % values.length];
}

describePostgres("PostgreSQL cross-browser reveal handoff", () => {
  let sql: Sql;
  const current = { value: new Date("2026-07-31T00:00:00.000Z") };

  function application() {
    return new PostgresApplicationRuntime({
      sql,
      clock: { now: () => new Date(current.value) },
      random: { randomBit: deterministicBits(), randomInt: () => 0 },
    });
  }

  function handoffService() {
    return new PostgresRevealHandoffService({
      sql,
      clock: { now: () => new Date(current.value) },
    });
  }

  function authenticatedRevealService() {
    return new PostgresAuthenticatedRevealService({
      sql,
      clock: { now: () => new Date(current.value) },
    });
  }

  async function completedCasting(anonymousSessionHash: string) {
    const runtime = application();
    const draft = await runtime.createDraft({
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_should_i_pay_attention_to_next",
      userId: null,
      anonymousSessionHash,
    });
    await runtime.submitQuestion({
      castingId: draft.castingId,
      userId: null,
      anonymousSessionHash,
      context: "I need to understand how to approach a delayed role decision without forcing the outcome.",
    });
    for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
      await runtime.recordCoinLine({
        castingId: draft.castingId,
        userId: null,
        anonymousSessionHash,
        lineIndex: lineIndex as 0 | 1 | 2 | 3 | 4 | 5,
      });
    }
    return draft.castingId;
  }

  async function completedUserCasting(userId: string) {
    const runtime = application();
    const draft = await runtime.createDraft({
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_should_i_pay_attention_to_next",
      userId,
      anonymousSessionHash: null,
    });
    await runtime.submitQuestion({
      castingId: draft.castingId,
      userId,
      anonymousSessionHash: null,
      context: "I need to understand how to approach a delayed role decision without forcing the outcome.",
    });
    for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
      await runtime.recordCoinLine({
        castingId: draft.castingId,
        userId,
        anonymousSessionHash: null,
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
    current.value = new Date("2026-07-31T00:00:00.000Z");
    await resetPostgresForTests(sql);
  });

  afterAll(async () => {
    if (sql) await sql.end();
  });

  it("reveals a casting created by an authenticated user without an anonymous cookie", async () => {
    await sql`insert into users (id, email) values ('usr_owner', 'owner@example.com')`;
    const castingId = await completedUserCasting("usr_owner");

    await expect(authenticatedRevealService().reveal({
      castingId,
      authenticatedUserId: "usr_owner",
      anonymousSessionHash: null,
    })).resolves.toEqual({ revealed: true, duplicate: false, castingId });

    const rows = await sql`
      select user_id, anonymous_session_hash, lifecycle from casting_sessions where id = ${castingId}
    `;
    expect(rows[0]).toMatchObject({
      user_id: "usr_owner",
      anonymous_session_hash: null,
      lifecycle: "revealed",
    });
  });

  it("binds an anonymous casting when its browser session is already signed in", async () => {
    const castingId = await completedCasting("anon-already-signed-in");
    await sql`insert into users (id, email) values ('usr_owner', 'owner@example.com')`;

    await expect(authenticatedRevealService().reveal({
      castingId,
      authenticatedUserId: "usr_owner",
      anonymousSessionHash: "anon-already-signed-in",
    })).resolves.toEqual({ revealed: true, duplicate: false, castingId });

    const rows = await sql`
      select user_id, anonymous_session_hash, lifecycle from casting_sessions where id = ${castingId}
    `;
    expect(rows[0]).toMatchObject({
      user_id: "usr_owner",
      anonymous_session_hash: null,
      lifecycle: "revealed",
    });
  });

  it("reveals from a new browser using only opaque state and the authenticated identity", async () => {
    const handoffs = handoffService();
    const castingId = await completedCasting("anon-cross-browser");
    await sql`insert into users (id, email) values ('usr_owner', 'owner@example.com')`;

    const handoff = await handoffs.start({
      castingId,
      anonymousSessionHash: "anon-cross-browser",
      expectedEmail: "Owner@Example.COM",
      allowedCallbackPath: `/result/${castingId}`,
    });

    expect(handoff.handoffState).not.toContain(castingId);
    expect(handoff.handoffState).not.toContain("owner@example.com");

    const revealed = await handoffs.consume({
      handoffState: handoff.handoffState,
      authenticatedUserId: "usr_owner",
      authenticatedEmail: "owner@example.com",
    });
    expect(revealed).toEqual({ revealed: true, duplicate: false, castingId });

    await expect(handoffs.consume({
      handoffState: handoff.handoffState,
      authenticatedUserId: "usr_owner",
      authenticatedEmail: "owner@example.com",
    })).rejects.toThrow("LOGIN_INTENT_CONSUMED");
  });

  it("does not consume the intent for a mismatched email and rejects tampered state", async () => {
    const handoffs = handoffService();
    const castingId = await completedCasting("anon-email-bound");
    await sql`insert into users (id, email) values
      ('usr_owner', 'owner@example.com'),
      ('usr_attacker', 'attacker@example.com')`;

    const handoff = await handoffs.start({
      castingId,
      anonymousSessionHash: "anon-email-bound",
      expectedEmail: "owner@example.com",
      allowedCallbackPath: `/result/${castingId}`,
    });

    await expect(handoffs.consume({
      handoffState: handoff.handoffState,
      authenticatedUserId: "usr_attacker",
      authenticatedEmail: "attacker@example.com",
    })).rejects.toThrow("LOGIN_INTENT_EMAIL_MISMATCH");

    await expect(handoffs.consume({
      handoffState: `${handoff.handoffState}tampered`,
      authenticatedUserId: "usr_owner",
      authenticatedEmail: "owner@example.com",
    })).rejects.toThrow("LOGIN_INTENT_INVALID");

    await expect(handoffs.consume({
      handoffState: handoff.handoffState,
      authenticatedUserId: "usr_owner",
      authenticatedEmail: "owner@example.com",
    })).resolves.toEqual({ revealed: true, duplicate: false, castingId });
  });

  it("rejects an expired handoff before binding the casting", async () => {
    const handoffs = handoffService();
    const castingId = await completedCasting("anon-expired-handoff");
    await sql`insert into users (id, email) values ('usr_owner', 'owner@example.com')`;
    const handoff = await handoffs.start({
      castingId,
      anonymousSessionHash: "anon-expired-handoff",
      expectedEmail: "owner@example.com",
      allowedCallbackPath: `/result/${castingId}`,
    });

    current.value = new Date("2026-07-31T00:10:00.001Z");
    await expect(handoffs.consume({
      handoffState: handoff.handoffState,
      authenticatedUserId: "usr_owner",
      authenticatedEmail: "owner@example.com",
    })).rejects.toThrow("LOGIN_INTENT_EXPIRED");

    const rows = await sql`select consumed_at from login_intents where casting_session_id = ${castingId}`;
    expect(rows[0]).toMatchObject({ consumed_at: null });
    const castRows = await sql`select user_id, lifecycle from casting_sessions where id = ${castingId}`;
    expect(castRows[0]).toMatchObject({ user_id: null, lifecycle: "awaiting_reveal" });
  });
});
