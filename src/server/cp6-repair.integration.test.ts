import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { databaseSchema } from "@/server/db/schema";
import { closeCommercialDatabaseConnection } from "@/server/db/client";
import { createDeepReadingService } from "@/server/generation/deep-reading-service";
import { calculateResultIntegrityHmac } from "@/server/generation/integrity";
import { encryptQuestionForStorage } from "@/server/generation/question-crypto";
import { claimJobLeaseStep, finalizeDeepReadingStep } from "@/server/workflows/deep-reading-steps";
import type { DeterministicFacts } from "@/domain/generation/schemas";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");

const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql, { schema: databaseSchema });
const previousDatabaseURL = process.env.DATABASE_URL;
const previousIntegrityKeys = process.env.RESULT_INTEGRITY_KEYS;
const previousQuestionEncryptionKeys = process.env.QUESTION_ENCRYPTION_KEYS;
const integrityKeys = "v1:cp6-result-integrity-key-material-000000000001";
const questionEncryptionKeys = "v1:cp6-question-encryption-key-material-000000000001";

const facts: DeterministicFacts = {
  method: "three_coin",
  algorithmVersion: "three-coin-v1",
  classicMappingVersion: "king-wen-v1",
  lineValuesBottomUp: [7, 8, 7, 8, 7, 8],
  primaryHexagramNumber: 11,
  movingLinePositions: [],
  relatingHexagramNumber: null,
  readingVariant: "still_hexagram",
};

async function insertUser(userId: string): Promise<void> {
  await sql`
    insert into users (id, name, email, email_verified, created_at, updated_at)
    values (${userId}, 'CP6 Repair', ${`${userId}@example.com`}, true, clock_timestamp(), clock_timestamp())
  `;
}

async function insertCasting(
  userId: string,
  castingId: string,
  options: { invalidResultHmac?: boolean } = {},
): Promise<void> {
  const integrity = calculateResultIntegrityHmac(facts, { RESULT_INTEGRITY_KEYS: integrityKeys });
  const resultHmac = options.invalidResultHmac ? "0".repeat(64) : integrity.hmac;
  await sql`
    insert into casting_sessions (
      id, user_id, method, lifecycle, risk_status, scene, interpretation_goal,
      generation_epoch, created_at, updated_at
    ) values (
      ${castingId}, ${userId}, 'three_coin', 'revealed', 'allowed', 'career', 'guidance',
      0, clock_timestamp(), clock_timestamp()
    )
  `;
  await sql`
    insert into cast_results (
      casting_id, line_values, primary_hexagram_number, moving_line_positions,
      relating_hexagram_number, method_calculation, algorithm_version,
      classic_mapping_version, result_hmac, result_hmac_key_version, created_at
    ) values (
      ${castingId}, ARRAY[7,8,7,8,7,8]::integer[], 11, ARRAY[]::integer[], null,
      '{"kind":"cp6-repair"}'::jsonb, 'three-coin-v1', 'king-wen-v1',
      ${resultHmac}, ${integrity.version}, clock_timestamp()
    )
  `;
  const questionVersionId = randomUUID();
  const encryptedQuestion = encryptQuestionForStorage({
    castingId,
    questionVersionId,
    question: "What should I focus on in this transition?",
  }, { QUESTION_ENCRYPTION_KEYS: questionEncryptionKeys });
  await sql`
    insert into question_versions (
      id, casting_id, version_number, ciphertext, iv, auth_tag, encryption_key_version,
      fingerprint_key_version, fingerprint, created_reason, created_at
    ) values (
      ${questionVersionId}, ${castingId}, 1, ${encryptedQuestion.ciphertext}, ${encryptedQuestion.iv},
      ${encryptedQuestion.authTag}, ${encryptedQuestion.encryptionKeyVersion}, 'v1', 'cp6-fixture', 'initial_cast', clock_timestamp()
    )
  `;
}

async function insertCredit(userId: string, expiresIn: string = "12 months"): Promise<{ batchId: string }> {
  const orderId = randomUUID();
  const batchId = randomUUID();
  await sql`
    insert into payment_orders (
      id, user_id, product_key, quantity, amount_minor, currency, request_id,
      provider, provider_environment, provider_product_id, provider_order_id,
      provider_payment_id, status, paid_at, created_at, updated_at
    ) values (
      ${orderId}, ${userId}, 'one', 1, 299, 'USD', ${`req-${orderId}`},
      'waffo', 'test', 'prod-1', ${`ord-${orderId}`}, ${`pay-${orderId}`},
      'paid', clock_timestamp(), clock_timestamp(), clock_timestamp()
    )
  `;
  await sql.unsafe(`
    insert into entitlement_batches (
      id, user_id, order_id, quantity_total, quantity_available, quantity_reserved,
      quantity_consumed, quantity_revoked, expires_at, created_at, updated_at
    ) values (
      $1, $2, $3, 1, 1, 0, 0, 0,
      clock_timestamp() + interval '${expiresIn.replaceAll("'", "")}', clock_timestamp(), clock_timestamp()
    )
  `, [batchId, userId, orderId]);
  return { batchId };
}

function service() {
  return createDeepReadingService({
    sql,
    workflowStarter: {
      startDeepReadingWorkflow: async () => ({ runId: `run-${randomUUID()}`, started: true }),
    },
  });
}

function validEnrichment() {
  return {
    contextNotes: "The timeline changed and I need to decide what information matters next.",
    options: [],
    constraints: [],
    concerns: [],
    interpretationGoal: "what_do_i_need_to_see_clearly" as const,
    locale: "en" as const,
  };
}

async function prepareClaimedReading() {
  const userId = `cp6-final-${randomUUID()}`;
  const castingId = randomUUID();
  await insertUser(userId);
  const { batchId } = await insertCredit(userId);
  await insertCasting(userId, castingId);
  const requested = await service().requestDeepReading({ userId, castingId, enrichment: validEnrichment() });
  const jobRows = await sql<{ idempotency_key: string; generation_epoch: number }[]>`
    select idempotency_key, generation_epoch from generation_jobs where id = ${requested.jobId}
  `;
  const claimed = await claimJobLeaseStep({
    castingId,
    jobId: requested.jobId,
    idempotencyKey: String(jobRows[0]!.idempotency_key),
    generationEpoch: Number(jobRows[0]!.generation_epoch),
  });
  return {
    userId,
    castingId,
    batchId,
    jobId: requested.jobId,
    reservationId: requested.reservationId,
    idempotencyKey: String(jobRows[0]!.idempotency_key),
    generationEpoch: Number(jobRows[0]!.generation_epoch),
    leaseToken: claimed.leaseToken,
    inputSnapshotHash: claimed.inputSnapshotHash,
  };
}

async function expectFinalizationFence(
  prepared: Awaited<ReturnType<typeof prepareClaimedReading>>,
  expectedError: string,
): Promise<void> {
  await expect(finalizeDeepReadingStep({
    castingId: prepared.castingId,
    jobId: prepared.jobId,
    reservationId: prepared.reservationId,
    idempotencyKey: prepared.idempotencyKey,
    generationEpoch: prepared.generationEpoch,
    inputSnapshotHash: prepared.inputSnapshotHash,
    leaseToken: prepared.leaseToken,
    generationResult: { output: {}, deterministicFacts: {} },
    reviewDecision: {
      status: "pass",
      reasonCodes: [],
      schemaValid: true,
      safetyPass: true,
      factConsistencyPass: true,
      questionRelevancePass: true,
      contextFidelityPass: true,
      evidenceGroundingPass: true,
      interpretiveCoherencePass: true,
      actionabilityPass: true,
      uncertaintyPass: true,
      languageConsistencyPass: true,
    },
  })).rejects.toThrow(expectedError);

  const reservations = await sql<{ status: string }[]>`
    select status from entitlement_reservations where id = ${prepared.reservationId}
  `;
  expect(reservations).toEqual([{ status: "reserved" }]);

  const results = await sql<{ count: number }[]>`
    select count(*)::integer as count from deep_reading_results where casting_id = ${prepared.castingId}
  `;
  expect(results[0]?.count).toBe(0);

  const batches = await sql<{ quantity_consumed: number; quantity_reserved: number }[]>`
    select quantity_consumed, quantity_reserved from entitlement_batches where id = ${prepared.batchId}
  `;
  expect(batches).toEqual([{ quantity_consumed: 0, quantity_reserved: 1 }]);
}

describe("CP6 repair regressions", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseURL;
    process.env.RESULT_INTEGRITY_KEYS = integrityKeys;
    process.env.QUESTION_ENCRYPTION_KEYS = questionEncryptionKeys;
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await closeCommercialDatabaseConnection();
    if (previousDatabaseURL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseURL;
    if (previousIntegrityKeys === undefined) delete process.env.RESULT_INTEGRITY_KEYS;
    else process.env.RESULT_INTEGRITY_KEYS = previousIntegrityKeys;
    if (previousQuestionEncryptionKeys === undefined) delete process.env.QUESTION_ENCRYPTION_KEYS;
    else process.env.QUESTION_ENCRYPTION_KEYS = previousQuestionEncryptionKeys;
    await sql.end({ timeout: 5 });
  });

  it("inherits reservation expiry from the earliest entitlement batch and sets a bounded initial lease", async () => {
    const userId = `cp6-expiry-${randomUUID()}`;
    const castingId = randomUUID();
    await insertUser(userId);
    const { batchId } = await insertCredit(userId, "2 minutes");
    await insertCasting(userId, castingId);

    const requested = await service().requestDeepReading({ userId, castingId, enrichment: validEnrichment() });
    const rows = await sql<{
      reservation_expires_at: Date | string;
      lease_expires_at: Date | string | null;
      batch_expires_at: Date | string;
    }[]>`
      select r.expires_at as reservation_expires_at,
             r.lease_expires_at,
             b.expires_at as batch_expires_at
      from entitlement_reservations r
      join entitlement_batches b on b.id = r.batch_id
      where r.id = ${requested.reservationId} and b.id = ${batchId}
    `;

    expect(rows[0]).toBeDefined();
    const reservationExpiresAt = new Date(rows[0]!.reservation_expires_at).getTime();
    const batchExpiresAt = new Date(rows[0]!.batch_expires_at).getTime();
    expect(reservationExpiresAt).toBe(batchExpiresAt);
    expect(rows[0]!.lease_expires_at).not.toBeNull();
    expect(new Date(rows[0]!.lease_expires_at!).getTime()).toBeLessThanOrEqual(batchExpiresAt);
  });

  it("rechecks revealed lifecycle immediately before persisting and consuming", async () => {
    const prepared = await prepareClaimedReading();
    await sql`update casting_sessions set lifecycle = 'draft', updated_at = clock_timestamp() where id = ${prepared.castingId}`;
    await expectFinalizationFence(prepared, "CASTING_NOT_READY");
  });

  it("rechecks allowed risk immediately before persisting and consuming", async () => {
    const prepared = await prepareClaimedReading();
    await sql`update casting_sessions set risk_status = 'emergency_blocked', updated_at = clock_timestamp() where id = ${prepared.castingId}`;
    await expectFinalizationFence(prepared, "RISK_PROHIBITED");
  });

  it("rejects a forged cast-result HMAC before starting generation or consuming credit", async () => {
    const userId = `cp6-invalid-hmac-${randomUUID()}`;
    const castingId = randomUUID();
    await insertUser(userId);
    const { batchId } = await insertCredit(userId);
    await insertCasting(userId, castingId, { invalidResultHmac: true });

    await expect(service().requestDeepReading({ userId, castingId, enrichment: validEnrichment() }))
      .rejects.toThrow("CAST_RESULT_INTEGRITY_INVALID");

    const reservations = await sql<{ count: number }[]>`
      select count(*)::int as count from entitlement_reservations where casting_id = ${castingId}
    `;
    expect(reservations).toEqual([{ count: 0 }]);
    const jobs = await sql<{ count: number }[]>`
      select count(*)::int as count from generation_jobs where casting_id = ${castingId}
    `;
    expect(jobs).toEqual([{ count: 0 }]);
    const batches = await sql<{ quantity_available: number; quantity_reserved: number }[]>`
      select quantity_available, quantity_reserved from entitlement_batches where id = ${batchId}
    `;
    expect(batches).toEqual([{ quantity_available: 1, quantity_reserved: 0 }]);
  });
});
