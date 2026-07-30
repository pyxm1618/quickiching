import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";
import { PostgresAtomicRepository } from "./atomic-repository";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

async function insertUser(sql: Sql, id: string) {
  await sql`insert into users (id, email) values (${id}, ${`${id}@example.com`})`;
}

async function insertCasting(sql: Sql, input: {
  id: string;
  anonymousHash: string;
  lifecycle?: string;
  revealExpiresAt?: Date;
}) {
  await sql`
    insert into casting_sessions (
      id, anonymous_session_hash, anonymous_hash_key_version, method, lifecycle,
      risk_status, scene, interpretation_goal, algorithm_version, reveal_expires_at
    ) values (
      ${input.id}, ${input.anonymousHash}, 'v1', 'three_coin', ${input.lifecycle ?? "awaiting_reveal"},
      'allowed', 'career', 'what_do_i_need_to_see_clearly', 'three-coin-v1',
      ${input.revealExpiresAt ?? new Date("2026-08-01T00:00:00.000Z")}
    )
  `;
}

async function insertIntent(sql: Sql, input: {
  id: string;
  castingId: string;
  anonymousHash: string;
  nonceHash: string;
}) {
  await sql`
    insert into login_intents (
      id, casting_session_id, anonymous_session_hash, nonce_hash, nonce_key_version,
      allowed_callback_path, expires_at
    ) values (
      ${input.id}, ${input.castingId}, ${input.anonymousHash}, ${input.nonceHash}, 'v1',
      ${`/result/${input.castingId}`}, ${new Date("2026-08-01T00:00:00.000Z")}
    )
  `;
}

describePostgres("PostgreSQL critical transactions", () => {
  let sql: Sql;
  let repository: PostgresAtomicRepository;

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 8 });
    await migratePostgres(sql);
    repository = new PostgresAtomicRepository(sql);
  });

  beforeEach(async () => {
    await resetPostgresForTests(sql);
  });

  afterAll(async () => {
    if (sql) await sql.end();
  });

  it("consumes a Login Intent exactly once under concurrent callbacks", async () => {
    await insertUser(sql, "usr_login_once");
    await insertCasting(sql, { id: "cas_login_once", anonymousHash: "anon-login-once" });
    await insertIntent(sql, {
      id: "lint_login_once",
      castingId: "cas_login_once",
      anonymousHash: "anon-login-once",
      nonceHash: "nonce-login-once",
    });

    const input = {
      intentId: "lint_login_once",
      nonceHash: "nonce-login-once",
      nonceKeyVersion: "v1",
      authenticatedUserId: "usr_login_once",
      callbackPath: "/result/cas_login_once",
      fingerprintCandidates: [{ fingerprint: "fp-login-once", keyVersion: "v1" }],
      writeFingerprint: { fingerprint: "fp-login-once", keyVersion: "v1" },
      now: new Date("2026-07-30T00:00:00.000Z"),
    } as const;

    const outcomes = await Promise.allSettled([
      repository.consumeLoginIntentAndReveal(input),
      repository.consumeLoginIntentAndReveal(input),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);

    const [intent] = await sql`select consumed_at from login_intents where id = 'lint_login_once'`;
    const [casting] = await sql`select user_id, lifecycle from casting_sessions where id = 'cas_login_once'`;
    expect(intent.consumed_at).toBeInstanceOf(Date);
    expect(casting).toMatchObject({ user_id: "usr_login_once", lifecycle: "revealed" });
  });

  it("serializes same-question reveals across fingerprint key versions", async () => {
    await insertUser(sql, "usr_rotation");
    await insertCasting(sql, { id: "cas_rotation_a", anonymousHash: "anon-rotation-a" });
    await insertCasting(sql, { id: "cas_rotation_b", anonymousHash: "anon-rotation-b" });
    await insertIntent(sql, {
      id: "lint_rotation_a",
      castingId: "cas_rotation_a",
      anonymousHash: "anon-rotation-a",
      nonceHash: "nonce-rotation-a",
    });
    await insertIntent(sql, {
      id: "lint_rotation_b",
      castingId: "cas_rotation_b",
      anonymousHash: "anon-rotation-b",
      nonceHash: "nonce-rotation-b",
    });

    const shared = {
      authenticatedUserId: "usr_rotation",
      fingerprintCandidates: [
        { fingerprint: "fp-old-version", keyVersion: "v1" },
        { fingerprint: "fp-new-version", keyVersion: "v2" },
      ],
      writeFingerprint: { fingerprint: "fp-new-version", keyVersion: "v2" },
      now: new Date("2026-07-30T00:00:00.000Z"),
    } as const;

    const outcomes = await Promise.all([
      repository.consumeLoginIntentAndReveal({
        ...shared,
        intentId: "lint_rotation_a",
        nonceHash: "nonce-rotation-a",
        nonceKeyVersion: "v1",
        callbackPath: "/result/cas_rotation_a",
      }),
      repository.consumeLoginIntentAndReveal({
        ...shared,
        intentId: "lint_rotation_b",
        nonceHash: "nonce-rotation-b",
        nonceKeyVersion: "v1",
        callbackPath: "/result/cas_rotation_b",
      }),
    ]);

    expect(outcomes.filter((outcome) => outcome.revealed && !outcome.duplicate)).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.duplicate)).toHaveLength(1);
    expect(new Set(outcomes.map((outcome) => outcome.castingId))).toHaveLength(1);

    const locks = await sql`select winning_casting_id from question_locks where user_id = 'usr_rotation'`;
    expect(locks).toHaveLength(1);
  });

  it("freezes the earliest-expiring entitlement once under concurrent requests", async () => {
    await insertUser(sql, "usr_entitlement_race");
    await sql`
      insert into entitlement_batches (
        id, user_id, product_id, amount_usd, quantity_total, quantity_available,
        quantity_reserved, quantity_consumed, quantity_revoked, expires_at
      ) values (
        'bat_race', 'usr_entitlement_race', 'one', 2.99, 1, 1, 0, 0, 0,
        ${new Date("2027-07-30T00:00:00.000Z")}
      )
    `;
    await sql`
      insert into casting_sessions (
        id, user_id, method, lifecycle, risk_status, scene, interpretation_goal, algorithm_version
      ) values
        ('cas_reading_a', 'usr_entitlement_race', 'three_coin', 'revealed', 'allowed', 'career', 'what_do_i_need_to_see_clearly', 'three-coin-v1'),
        ('cas_reading_b', 'usr_entitlement_race', 'three_coin', 'revealed', 'allowed', 'career', 'what_do_i_need_to_see_clearly', 'three-coin-v1')
    `;
    await sql`
      insert into readings (id, casting_session_id, status, schema_version, generation_epoch)
      values
        ('rdg_race_a', 'cas_reading_a', 'not_started', 'reading-v1', 0),
        ('rdg_race_b', 'cas_reading_b', 'not_started', 'reading-v1', 0)
    `;

    const now = new Date("2026-07-30T00:00:00.000Z");
    const outcomes = await Promise.all([
      repository.freezeForReading("rdg_race_a", "usr_entitlement_race", now),
      repository.freezeForReading("rdg_race_b", "usr_entitlement_race", now),
    ]);

    expect(outcomes.filter((outcome) => "reservationId" in outcome)).toHaveLength(1);
    expect(outcomes.filter((outcome) => "error" in outcome)).toEqual([
      { error: "ENTITLEMENT_NOT_AVAILABLE" },
    ]);

    const [batch] = await sql`
      select quantity_available, quantity_reserved, quantity_consumed, quantity_revoked
      from entitlement_batches where id = 'bat_race'
    `;
    expect(batch).toMatchObject({
      quantity_available: 0,
      quantity_reserved: 1,
      quantity_consumed: 0,
      quantity_revoked: 0,
    });
  });
});
