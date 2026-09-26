import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const authState = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/auth/session", () => ({
  resolveSession: async () => authState.userId ? { user: { id: authState.userId } } : null,
}));

import { POST as saveReading } from "@/app/api/readings/route";
import { closeCommercialDatabaseConnection } from "./client";

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

function saveRequest(body: unknown) {
  return new Request("https://www.quickiching.com/api/readings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://www.quickiching.com",
      referer: "https://www.quickiching.com/readings/three-coin/result",
      "sec-fetch-site": "same-origin",
      host: "www.quickiching.com",
    },
    body: JSON.stringify(body),
  });
}

function saveInput(clientCastingId: string, question: string) {
  return {
    clientCastingId,
    lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
    question,
    scene: "career",
    interpretationGoal: "what_do_i_need_to_see_clearly",
  };
}

async function createUser() {
  const userId = `question-lock-user-${randomUUID()}`;
  await sql`
    insert into users (id, name, email, email_verified, created_at, updated_at)
    values (${userId}, 'Question Lock Test', ${`${userId}@test.example`}, true, now(), now())
  `;
  authState.userId = userId;
  return userId;
}

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
    vi.stubEnv("DATABASE_ADAPTER_MODE", "postgres");
    vi.stubEnv("DATABASE_URL", databaseURL!);
    vi.stubEnv("APP_BASE_URL", "https://www.quickiching.com");
    vi.stubEnv("BETTER_AUTH_URL", "https://www.quickiching.com");
    vi.stubEnv("QUESTION_FINGERPRINT_KEYS", "v1:question-lock-fingerprint-fixture-key");
    vi.stubEnv("QUESTION_ENCRYPTION_KEYS", "v1:question-lock-encryption-fixture-key");
    vi.stubEnv("RESULT_INTEGRITY_KEYS", "v1:question-lock-result-fixture-key");
  });

  afterAll(async () => {
    authState.userId = "";
    vi.unstubAllEnvs();
    await closeCommercialDatabaseConnection();
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

  it("binds the first cast to its question for 72 hours and keeps retries idempotent", async () => {
    const userId = await createUser();
    const firstCastingId = randomUUID();
    const blockedCastingId = randomUUID();
    const distinctQuestionCastingId = randomUUID();
    const question = "How should I approach the next step?";

    const firstResponse = await saveReading(saveRequest(saveInput(firstCastingId, question)));
    expect(firstResponse.status).toBe(201);
    await expect(firstResponse.json()).resolves.toMatchObject({ castingId: firstCastingId, idempotent: false });

    const retryResponse = await saveReading(saveRequest(saveInput(firstCastingId, `  ${question.toUpperCase()}  `)));
    expect(retryResponse.status).toBe(200);
    await expect(retryResponse.json()).resolves.toMatchObject({ castingId: firstCastingId, idempotent: true });

    const blockedResponse = await saveReading(saveRequest(saveInput(blockedCastingId, `  ${question.toUpperCase()}! `)));
    expect(blockedResponse.status).toBe(409);
    await expect(blockedResponse.json()).resolves.toMatchObject({
      error: "QUESTION_LOCKED",
      previousCastingId: firstCastingId,
    });

    const otherQuestionResponse = await saveReading(saveRequest(saveInput(distinctQuestionCastingId, "What should I prioritize this week?")));
    expect(otherQuestionResponse.status).toBe(201);
    await expect(otherQuestionResponse.json()).resolves.toMatchObject({ castingId: distinctQuestionCastingId });

    const rows = await sql`
      select count(*)::integer as count from casting_sessions
      where user_id = ${userId} and deleted_at is null
    ` as Array<{ count: number }>;
    expect(rows[0]?.count).toBe(2);
  });

  it("serializes concurrent casts for the same core question", async () => {
    await createUser();
    const castingIds = [randomUUID(), randomUUID()];
    const question = "What deserves my attention over the next month?";
    const responses = await Promise.all(castingIds.map((clientCastingId) =>
      saveReading(saveRequest(saveInput(clientCastingId, question))),
    ));

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    const winner = bodies.find((body) => body.idempotent === false);
    const blocked = bodies.find((body) => body.error === "QUESTION_LOCKED");
    expect(winner?.castingId).toBeDefined();
    expect(blocked?.previousCastingId).toBe(winner?.castingId);
  });
});
