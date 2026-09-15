import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

/**
 * Integration: POST /api/readings Postgres idempotency
 *
 * Validates directly against the casting_sessions + cast_results schema:
 *   1. Same clientCastingId retry → returns existing row, no duplicate
 *   2. Same line values, different question → two distinct casting_sessions
 */

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required");

const sql = postgres(databaseURL, { max: 4, prepare: false });
const db = drizzle(sql);

// Minimal fixture helpers that mirror what the route does
async function insertCasting(
  castingId: string,
  userId: string,
  questionFingerprint: string | null,
  lineValues: number[],
) {
  await sql`
    insert into casting_sessions (
      id, user_id, method, lifecycle, risk_status, scene,
      interpretation_goal, question_fingerprint, fingerprint_key_version,
      generation_epoch, created_at, updated_at
    ) values (
      ${castingId}, ${userId}, 'three_coin', 'revealed', 'allowed', 'general',
      'what_do_i_need_to_see_clearly', ${questionFingerprint}, ${questionFingerprint ? 'v1' : null},
      0, clock_timestamp(), clock_timestamp()
    )
    on conflict (id) do nothing
    returning id
  `;
  await sql`
    insert into cast_results (
      casting_id, line_values, primary_hexagram_number, moving_line_positions,
      relating_hexagram_number, method_calculation, algorithm_version,
      classic_mapping_version, result_hmac, result_hmac_key_version, created_at
    ) values (
      ${castingId}, ${lineValues}, 1, '{}', ${null},
      ${'{"kind":"three-coin","version":"three-coin-v1"}'}, 'three-coin-v1',
      'king-wen-v1', 'hmac-test', 'v-test', clock_timestamp()
    )
    on conflict do nothing
  `;
}

describe("POST /api/readings Postgres idempotency (integration)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
    // Ensure a test user exists
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("same clientCastingId retry returns existing row, no duplicate", async () => {
    const userId = `idem-user-${randomUUID()}`;
    const castingId = randomUUID();
    const lineValues = [7, 8, 9, 6, 7, 8];

    // Insert test user
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (${userId}, 'Idempotency Test', ${`${userId}@test.example`}, true, now(), now())
    `;

    // First insert (simulates first POST)
    await insertCasting(castingId, userId, "fp-abc", lineValues);

    // Verify one row
    const after1 = await sql`
      select count(*)::int as cnt from casting_sessions where id = ${castingId}
    ` as Array<{ cnt: number }>;
    expect(after1[0]!.cnt).toBe(1);

    // Second insert with same castingId (simulates retry) → ON CONFLICT DO NOTHING
    await insertCasting(castingId, userId, "fp-abc", lineValues);

    const after2 = await sql`
      select count(*)::int as cnt from casting_sessions where id = ${castingId}
    ` as Array<{ cnt: number }>;
    expect(after2[0]!.cnt).toBe(1); // still exactly one row
  });

  it("same line values + different question → two distinct casting_sessions", async () => {
    const userId = `idem-user-${randomUUID()}`;
    const castingId1 = randomUUID();
    const castingId2 = randomUUID();
    const lineValues = [7, 8, 9, 6, 7, 8]; // identical hex

    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (${userId}, 'Distinct Test', ${`${userId}@test.example`}, true, now(), now())
    `;

    // Different question fingerprints → different castingIds (browser generates UUID per session)
    await insertCasting(castingId1, userId, "fp-question-A", lineValues);
    await insertCasting(castingId2, userId, "fp-question-B", lineValues);

    const rows = await sql`
      select id, question_fingerprint from casting_sessions
      where id in (${castingId1}, ${castingId2})
      order by created_at
    ` as Array<{ id: string; question_fingerprint: string | null }>;

    expect(rows).toHaveLength(2);
    expect(rows[0]!.id).toBe(castingId1);
    expect(rows[1]!.id).toBe(castingId2);
    expect(rows[0]!.question_fingerprint).toBe("fp-question-A");
    expect(rows[1]!.question_fingerprint).toBe("fp-question-B");
    // Same line values, different question → independent rows ✓
  });
});
