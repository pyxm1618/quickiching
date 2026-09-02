import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { evaluateRisk } from "@/domain/risk/engine";
import type { LineValue } from "@/domain/casting/types";
import { createPostgresCastingRepository } from "./postgres-repository";
import { createReadingPageReader } from "./reading-page-reader";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");

const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql);

const QUESTION = "Should I take the role I was offered in another city next spring?";
const RETURN_LINES: LineValue[] = [9, 8, 8, 8, 8, 8];

type Row = Record<string, any>;

async function seedUser(label: string): Promise<string> {
  const suffix = randomUUID();
  const userId = `reading-page-${label}-${suffix}`;
  await sql`
    insert into users (id, name, email, email_verified)
    values (${userId}, ${`Reading ${label}`}, ${`${label}-${suffix}@example.com`}, true)
  `;
  return userId;
}

async function seedCast(userId: string, question = QUESTION, scene: "career" | "other" = "career") {
  return createPostgresCastingRepository({ sql, env: process.env }).persistAttestedCast({
    userId,
    method: "three_coin",
    scene,
    interpretationGoal: "what_do_i_need_to_see_clearly",
    question,
    facts: buildHexagramResult({ lineValuesBottomUp: RETURN_LINES, method: "three_coin" }),
    risk: evaluateRisk(question, scene),
  });
}

function reader() {
  return createReadingPageReader({ sql });
}

/** A minimal report that satisfies readingReportV2Schema. */
function validReport() {
  const prose = "Prose long enough to be meaningful for this fixture.";
  return {
    schemaVersion: "commercial-reading-v2",
    locale: "en",
    readingVariant: "standard",
    deterministic: {
      primaryHexagramNumber: 24,
      relatingHexagramNumber: 2,
      nuclearHexagramNumber: 2,
      movingLinePositions: [1],
      changeRuleId: "one_moving",
      direction: "favorable",
      tiYong: { tiTrigram: "gen", yongTrigram: "kan", relation: "yong_generates_ti" },
      quotes: [{
        role: "primary",
        hexagramNumber: 24,
        hexagramChineseName: "復",
        label: "Initial Nine",
        text: "Return from a short distance. No need for remorse.",
        sourceWork: "Zhouyi, Wikisource",
        sourceUrl: "https://zh.wikisource.org/wiki/example",
      }],
    },
    generated: {
      verdictEcho: "favorable",
      questionRestatement: prose,
      oracleApplication: prose,
      currentStage: prose,
      structuralReading: prose,
      changeMechanism: prose,
      obstacles: prose,
      turningConditions: prose,
      conditionalGuidance: prose,
      uncertaintyAndBoundaries: prose,
    },
    disclaimer: prose,
  };
}

describe("CP6 reading page reader", () => {
  beforeAll(async () => {
    vi.stubEnv("APP_SECRET", "cp6-reading-page-secret");
    vi.stubEnv("QUESTION_ENCRYPTION_KEYS", "v1:cp6-reading-page-question-key");
    vi.stubEnv("QUESTION_FINGERPRINT_KEYS", "v1:cp6-reading-page-fingerprint-key");
    vi.stubEnv("RESULT_INTEGRITY_KEYS", "v1:cp6-reading-page-integrity-key");
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await sql.end({ timeout: 5 });
  });

  it("returns the cast to the reader who owns it", async () => {
    const userId = await seedUser("owner");
    const { castingId } = await seedCast(userId);

    const view = await reader().readForUser(userId, castingId);

    expect(view).toMatchObject({
      castingId,
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_do_i_need_to_see_clearly",
      castOrigin: "client_attested",
      riskStatus: "allowed",
    });
  });

  it("recomputes the hexagram from the stored line values", async () => {
    const userId = await seedUser("recompute");
    const { castingId } = await seedCast(userId);

    const view = await reader().readForUser(userId, castingId);

    expect(view?.facts.lineValuesBottomUp).toEqual(RETURN_LINES);
    expect(view?.facts.primaryHexagramNumber).toBe(24);
    expect(view?.facts.movingLinePositions).toEqual([1]);
    expect(view?.facts.relatingHexagramNumber).toBe(2);
  });

  it("does not return another reader's cast", async () => {
    const [owner, stranger] = await Promise.all([seedUser("owner-b"), seedUser("stranger")]);
    const { castingId } = await seedCast(owner);

    await expect(reader().readForUser(stranger, castingId)).resolves.toBeNull();
  });

  it("answers a stranger exactly as it answers a missing cast", async () => {
    const [owner, stranger] = await Promise.all([seedUser("owner-c"), seedUser("stranger-c")]);
    const { castingId } = await seedCast(owner);

    const notOwned = await reader().readForUser(stranger, castingId);
    const notExisting = await reader().readForUser(stranger, randomUUID());

    expect(notOwned).toEqual(notExisting);
    expect(notOwned).toBeNull();
  });

  it("never exposes the stored question, encrypted or otherwise", async () => {
    const userId = await seedUser("question");
    const { castingId } = await seedCast(userId);

    const serialized = JSON.stringify(await reader().readForUser(userId, castingId));

    expect(serialized).not.toContain("another city");
    expect(serialized).not.toContain("ciphertext");
    expect(serialized).not.toContain("question");
  });

  it("reports a blocked cast with its true risk status", async () => {
    const userId = await seedUser("blocked");
    const question = "Should I stop taking the medication my doctor prescribed for me?";
    const { castingId } = await seedCast(userId, question, "other");

    const view = await reader().readForUser(userId, castingId);

    expect(view?.riskStatus).toBe("professional_decision_blocked");
  });

  it("reports no deep reading before one exists", async () => {
    const userId = await seedUser("no-reading");
    const { castingId } = await seedCast(userId);

    expect((await reader().readForUser(userId, castingId))?.deepReading).toEqual({ state: "none" });
  });

  it("returns a stored report that matches the schema", async () => {
    const userId = await seedUser("good-report");
    const { castingId } = await seedCast(userId);
    await insertDeepReading(castingId, userId, validReport());

    const view = await reader().readForUser(userId, castingId);

    expect(view?.deepReading.state).toBe("ready");
    expect(view?.deepReading).toMatchObject({
      report: {
        schemaVersion: "commercial-reading-v2",
        locale: "en",
        deterministic: { changeRuleId: "one_moving", direction: "favorable" },
      },
    });
  });

  it("marks a stored report that does not match the schema as unreadable", async () => {
    const userId = await seedUser("bad-report");
    const { castingId } = await seedCast(userId);
    await insertDeepReading(castingId, userId, { schemaVersion: "commercial-reading-v2", missing: "everything" });

    const view = await reader().readForUser(userId, castingId);

    // Not "none": something is stored, and saying so is the difference between
    // a display bug and telling a paying reader they have no reading.
    expect(view?.deepReading).toEqual({ state: "unreadable" });
  });
});

/**
 * deep_reading_results is guarded by a trigger that insists on the whole chain
 * being in the state a real worker would leave it: a *running* deep-reading job,
 * a *reserved* entitlement hold pointing at that job, and a passing output
 * review. The fixture therefore builds the chain rather than the row.
 */
async function insertDeepReading(castingId: string, userId: string, output: unknown): Promise<void> {
  const jobId = randomUUID();
  const batchId = randomUUID();
  const reservationId = randomUUID();
  const reviewId = randomUUID();
  const orderId = randomUUID();

  await sql`
    insert into payment_orders (
      id, user_id, product_key, quantity, amount_minor, currency, request_id,
      provider, provider_environment, provider_product_id, provider_order_id,
      provider_payment_id, status, paid_at
    ) values (
      ${orderId}, ${userId}, 'one', 1, 299, 'USD', ${`req-${orderId}`}, 'waffo', 'test',
      'prod-one', ${`ord-${orderId}`}, ${`pay-${orderId}`}, 'paid', clock_timestamp()
    )
  `;
  await sql`
    insert into entitlement_batches (
      id, user_id, order_id, quantity_total, quantity_available, quantity_reserved,
      quantity_consumed, quantity_revoked, expires_at
    ) values (${batchId}, ${userId}, ${orderId}, 1, 0, 1, 0, 0, clock_timestamp() + interval '12 months')
  `;
  await sql`
    insert into generation_jobs (
      id, casting_id, kind, status, generation_epoch, idempotency_key,
      input_snapshot_hash, timeout_at, attempt_count
    ) values (
      ${jobId}, ${castingId}, 'deep_reading', 'running', 0, ${`idem-${jobId}`},
      ${`hash-${jobId}`}, clock_timestamp() + interval '1 hour', 1
    )
  `;
  await sql`
    insert into entitlement_reservations (
      id, batch_id, user_id, casting_id, job_id, status, lease_token, lease_expires_at, expires_at
    ) values (
      ${reservationId}, ${batchId}, ${userId}, ${castingId}, ${jobId}, 'reserved',
      ${`lease-${reservationId}`}, clock_timestamp() + interval '5 minutes',
      clock_timestamp() + interval '12 months'
    )
  `;
  await sql`
    insert into generation_output_reviews (
      id, job_id, casting_id, kind, status, reason_codes, reviewer_model_version,
      schema_valid, safety_pass, fact_consistency_pass
    ) values (
      ${reviewId}, ${jobId}, ${castingId}, 'deep_reading', 'pass', '[]'::jsonb, 'model-v1',
      true, true, true
    )
  `;
  await sql`
    insert into deep_reading_results (
      casting_id, job_id, reservation_id, output, schema_version, prompt_version,
      provider, model, integrity_hash, integrity_key_version
    ) values (
      ${castingId}, ${jobId}, ${reservationId}, ${JSON.stringify(output)},
      'commercial-reading-v2', 'v2', 'test', 'test-model', ${`hash-${castingId}`}, 'v1'
    )
  `;
}
