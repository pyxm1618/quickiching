import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { databaseSchema } from "@/server/db/schema";
import { closeCommercialDatabaseConnection } from "@/server/db/client";
import { createDeepReadingService } from "@/server/generation/deep-reading-service";
import { calculateDeepReadingInputSnapshotHash } from "@/server/generation/integrity";
import { claimJobLeaseStep, finalizeDeepReadingStep } from "@/server/workflows/deep-reading-steps";
import { createPostgresAccountRepository } from "@/server/account/postgres-repository";
import { PostgresPaymentRepository } from "@/server/payments/postgres-repository";
import { canonicalWaffoPayloadHash, type NormalizedWaffoWebhook } from "@/server/payments/waffo-webhook";
import type { DeterministicFacts } from "@/domain/generation/schemas";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");

const previousDatabaseURL = process.env.DATABASE_URL;
const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql, { schema: databaseSchema });

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

async function insertUser(userId: string, email: string): Promise<void> {
  await sql`
    insert into users (id, name, email, email_verified, created_at, updated_at)
    values (${userId}, 'CP5 Remediation', ${email}, true, clock_timestamp(), clock_timestamp())
  `;
}

async function insertCastingWithResult(input: {
  userId: string;
  castingId: string;
  scene?: string;
  goal?: string;
  epoch?: number;
}): Promise<void> {
  const scene = input.scene ?? "career";
  const goal = input.goal ?? "guidance";
  const epoch = input.epoch ?? 0;
  await sql`
    insert into casting_sessions (
      id, user_id, method, lifecycle, risk_status, scene, interpretation_goal,
      generation_epoch, created_at, updated_at
    ) values (
      ${input.castingId}, ${input.userId}, 'three_coin', 'revealed', 'allowed',
      ${scene}, ${goal}, ${epoch}, clock_timestamp(), clock_timestamp()
    )
  `;
  await sql`
    insert into cast_results (
      casting_id, line_values, primary_hexagram_number, moving_line_positions,
      relating_hexagram_number, method_calculation, algorithm_version,
      classic_mapping_version, result_hmac, result_hmac_key_version, created_at
    ) values (
      ${input.castingId}, ARRAY[7,8,7,8,7,8]::integer[], 11, ARRAY[]::integer[], null,
      '{"kind":"cp5-remediation"}'::jsonb, 'three-coin-v1', 'king-wen-v1',
      'fixture-hmac', 'v1', clock_timestamp()
    )
  `;
}

async function insertPaidCredit(input: { userId: string; available?: number; reserved?: number }): Promise<{
  orderId: string;
  batchId: string;
}> {
  const orderId = randomUUID();
  const batchId = randomUUID();
  const available = input.available ?? 1;
  const reserved = input.reserved ?? 0;
  await sql`
    insert into payment_orders (
      id, user_id, product_key, quantity, amount_minor, currency, request_id,
      provider, provider_environment, provider_product_id, provider_order_id,
      provider_payment_id, status, paid_at, created_at, updated_at
    ) values (
      ${orderId}, ${input.userId}, 'one', 1, 299, 'USD', ${`req-${orderId}`},
      'waffo', 'test', 'prod-1', ${`ord-${orderId}`}, ${`pay-${orderId}`},
      'paid', clock_timestamp(), clock_timestamp(), clock_timestamp()
    )
  `;
  await sql`
    insert into entitlement_batches (
      id, user_id, order_id, quantity_total, quantity_available, quantity_reserved,
      quantity_consumed, quantity_revoked, expires_at, created_at, updated_at
    ) values (
      ${batchId}, ${input.userId}, ${orderId}, 1, ${available}, ${reserved}, 0, 0,
      clock_timestamp() + interval '12 months', clock_timestamp(), clock_timestamp()
    )
  `;
  return { orderId, batchId };
}

function makePaymentEvent(orderId: string, userId: string): NormalizedWaffoWebhook {
  const base: Omit<NormalizedWaffoWebhook, "canonicalPayloadSha256"> = {
    provider: "waffo",
    providerEnvironment: "test",
    deliveryId: `delivery-${randomUUID()}`,
    eventId: `event-${randomUUID()}`,
    eventType: "order.completed",
    storeId: "store-1",
    orderMerchantExternalId: orderId,
    merchantProvidedBuyerIdentity: userId,
    internalOrderId: orderId,
    refundTicketMerchantExternalId: null,
    providerOrderId: `provider-order-${orderId}`,
    providerPaymentId: `provider-payment-${orderId}`,
    productKey: "one",
    providerProductId: "prod-1",
    currency: "USD",
    amountMinor: 299,
    taxAmount: "0.00",
    total: "2.99",
    payloadSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    supported: true,
    manualReviewReason: null,
  };
  return {
    ...base,
    canonicalPayloadSha256: canonicalWaffoPayloadHash(base as NormalizedWaffoWebhook),
  };
}

describe("CP5 audit remediation regressions", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseURL;
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await closeCommercialDatabaseConnection();
    if (previousDatabaseURL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseURL;
    await sql.end({ timeout: 5 });
  });

  it("compensates a definitive workflow-start failure without leaving credit reserved", async () => {
    const suffix = randomUUID();
    const userId = `cp5-start-fail-${suffix}`;
    const castingId = randomUUID();
    await insertUser(userId, `${suffix}@example.com`);
    const { batchId } = await insertPaidCredit({ userId });
    await insertCastingWithResult({ userId, castingId });

    const service = createDeepReadingService({
      sql,
      workflowStarter: {
        startDeepReadingWorkflow: async () => {
          throw new Error("PROVIDER_START_FAILED");
        },
      },
    });

    await expect(service.requestDeepReading({ userId, castingId , locale: "en" }))
      .rejects.toThrow("WORKFLOW_START_FAILED");

    const jobs = await sql<{ id: string; status: string; structured_error_code: string | null }[]>`
      select id, status, structured_error_code from generation_jobs
      where casting_id = ${castingId} and kind = 'deep_reading'
    `;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.status).toBe("failed");
    expect(jobs[0]?.structured_error_code).toBe("WORKFLOW_START_FAILED");

    const reservations = await sql<{ status: string }[]>`
      select status from entitlement_reservations where job_id = ${jobs[0]!.id}
    `;
    expect(reservations).toEqual([{ status: "released" }]);

    const batches = await sql<{ quantity_available: number; quantity_reserved: number }[]>`
      select quantity_available, quantity_reserved from entitlement_batches where id = ${batchId}
    `;
    expect(batches).toEqual([{ quantity_available: 1, quantity_reserved: 0 }]);

    const workflows = await sql<{ status: string; error_code: string | null }[]>`
      select status, error_code from workflow_runs
      where entity_id = ${castingId} order by created_at desc limit 1
    `;
    expect(workflows).toEqual([{ status: "failed", error_code: "WORKFLOW_START_FAILED" }]);
  });

  it("rejects active generation-lease takeover and binds claim/finalize to the request-time snapshot", async () => {
    const suffix = randomUUID();
    const userId = `cp5-lease-${suffix}`;
    await insertUser(userId, `${suffix}@example.com`);

    const activeCastingId = randomUUID();
    const activeJobId = randomUUID();
    const activeIdempotencyKey = `deep:${activeCastingId}:0:${activeJobId}`;
    await insertCastingWithResult({ userId, castingId: activeCastingId });
    const activeSnapshot = calculateDeepReadingInputSnapshotHash({
      castingId: activeCastingId,
      userId,
      epoch: 0,
      question: "Reading for scene: career",
      scene: "career",
      interpretationGoal: "guidance",
      facts,
    });
    await sql`
      insert into generation_jobs (
        id, casting_id, kind, status, generation_epoch, idempotency_key,
        input_snapshot_hash, attempt_count, lease_owner, lease_token, lease_expires_at,
        timeout_at, created_at, updated_at
      ) values (
        ${activeJobId}, ${activeCastingId}, 'deep_reading', 'running', 0, ${activeIdempotencyKey},
        ${activeSnapshot}, 1, 'worker-a', 'live-token', clock_timestamp() + interval '5 minutes',
        clock_timestamp() + interval '10 minutes', clock_timestamp(), clock_timestamp()
      )
    `;
    await sql`
      insert into workflow_runs (
        id, workflow_name, idempotency_key, entity_type, entity_id, status, created_at, updated_at
      ) values (
        ${randomUUID()}, 'deep_reading', ${activeIdempotencyKey}, 'casting', ${activeCastingId},
        'running', clock_timestamp(), clock_timestamp()
      )
    `;

    await expect(claimJobLeaseStep({
      castingId: activeCastingId,
      jobId: activeJobId,
      idempotencyKey: activeIdempotencyKey,
      generationEpoch: 0,
      locale: "en",
    })).rejects.toThrow("GENERATION_JOB_LEASE_ACTIVE");

    await expect(finalizeDeepReadingStep({
      castingId: activeCastingId,
      jobId: activeJobId,
      reservationId: randomUUID(),
      idempotencyKey: activeIdempotencyKey,
      generationEpoch: 0,
      inputSnapshotHash: "not-the-request-snapshot",
      leaseToken: "live-token",
      locale: "en",
      generationResult: { output: {}, deterministicFacts: {} },
      reviewDecision: {
        status: "pass",
        reasonCodes: [],
        schemaValid: true,
        safetyPass: true,
        factConsistencyPass: true,
      },
    })).rejects.toThrow("INPUT_SNAPSHOT_MISMATCH");

    const changedCastingId = randomUUID();
    const changedJobId = randomUUID();
    const changedIdempotencyKey = `deep:${changedCastingId}:0:${changedJobId}`;
    await insertCastingWithResult({ userId, castingId: changedCastingId });
    const originalSnapshot = calculateDeepReadingInputSnapshotHash({
      castingId: changedCastingId,
      userId,
      epoch: 0,
      question: "Reading for scene: career",
      scene: "career",
      interpretationGoal: "guidance",
      facts,
    });
    await sql`
      insert into generation_jobs (
        id, casting_id, kind, status, generation_epoch, idempotency_key,
        input_snapshot_hash, timeout_at, created_at, updated_at
      ) values (
        ${changedJobId}, ${changedCastingId}, 'deep_reading', 'queued', 0, ${changedIdempotencyKey},
        ${originalSnapshot}, clock_timestamp() + interval '10 minutes', clock_timestamp(), clock_timestamp()
      )
    `;
    await sql`
      insert into workflow_runs (
        id, workflow_name, idempotency_key, entity_type, entity_id, status, created_at, updated_at
      ) values (
        ${randomUUID()}, 'deep_reading', ${changedIdempotencyKey}, 'casting', ${changedCastingId},
        'pending', clock_timestamp(), clock_timestamp()
      )
    `;
    await sql`
      update casting_sessions set scene = 'relationships', updated_at = clock_timestamp()
      where id = ${changedCastingId}
    `;

    await expect(claimJobLeaseStep({
      castingId: changedCastingId,
      jobId: changedJobId,
      idempotencyKey: changedIdempotencyKey,
      generationEpoch: 0,
      locale: "en",
    })).rejects.toThrow("INPUT_SNAPSHOT_MISMATCH");
  });

  it("erases encrypted questions and generated deep-reading content on account deletion", async () => {
    const suffix = randomUUID();
    const userId = `cp5-delete-content-${suffix}`;
    const castingId = randomUUID();
    const jobId = randomUUID();
    const reservationId = randomUUID();
    await insertUser(userId, `${suffix}@example.com`);
    const { batchId } = await insertPaidCredit({ userId, available: 0, reserved: 1 });
    await insertCastingWithResult({ userId, castingId });

    await sql`
      insert into question_versions (
        id, casting_id, version_number, ciphertext, iv, auth_tag,
        encryption_key_version, fingerprint_key_version, fingerprint, created_reason, created_at
      ) values (
        ${randomUUID()}, ${castingId}, 1, 'sensitive-ciphertext', 'sensitive-iv', 'sensitive-tag',
        'v1', 'v1', 'sensitive-fingerprint', 'initial', clock_timestamp()
      )
    `;
    await sql`
      insert into generation_jobs (
        id, casting_id, kind, status, generation_epoch, idempotency_key,
        input_snapshot_hash, lease_owner, lease_token, lease_expires_at,
        timeout_at, created_at, updated_at
      ) values (
        ${jobId}, ${castingId}, 'deep_reading', 'running', 0, ${`deep:${castingId}:0:${jobId}`},
        'snapshot', 'worker-a', 'delete-live-token', clock_timestamp() + interval '5 minutes',
        clock_timestamp() + interval '10 minutes', clock_timestamp(), clock_timestamp()
      )
    `;
    await sql`
      insert into entitlement_reservations (
        id, batch_id, user_id, casting_id, job_id, status, lease_token,
        expires_at, created_at, updated_at
      ) values (
        ${reservationId}, ${batchId}, ${userId}, ${castingId}, ${jobId}, 'reserved', 'reservation-token',
        clock_timestamp() + interval '12 months', clock_timestamp(), clock_timestamp()
      )
    `;
    await sql`
      insert into generation_output_reviews (
        id, job_id, casting_id, kind, status, reason_codes,
        reviewer_model_version, schema_valid, safety_pass, fact_consistency_pass, created_at
      ) values (
        ${randomUUID()}, ${jobId}, ${castingId}, 'deep_reading', 'pass', '[]'::jsonb,
        'reviewer-v1', true, true, true, clock_timestamp()
      )
    `;
    await sql`
      insert into deep_reading_results (
        casting_id, job_id, reservation_id, output, schema_version, prompt_version,
        provider, model, integrity_hash, integrity_key_version, persisted_at
      ) values (
        ${castingId}, ${jobId}, ${reservationId}, '{"report":"private generated content"}'::jsonb,
        'commercial-reading-v1', 'v1', 'google', 'test-model', 'integrity-hash', 'v-test', clock_timestamp()
      )
    `;

    const repository = createPostgresAccountRepository({ sql });
    await expect(repository.deleteAccount(userId)).resolves.toEqual({ success: true });

    const contentCounts = await sql<{ questions: number; readings: number }[]>`
      select
        (select count(*)::int from question_versions where casting_id = ${castingId}) as questions,
        (select count(*)::int from deep_reading_results where casting_id = ${castingId}) as readings
    `;
    expect(contentCounts).toEqual([{ questions: 0, readings: 0 }]);

    const castingRows = await sql<{ scene: string; interpretation_goal: string; deleted_at: string | null }[]>`
      select scene, interpretation_goal, deleted_at from casting_sessions where id = ${castingId}
    `;
    expect(castingRows[0]?.scene).toBe("deleted");
    expect(castingRows[0]?.interpretation_goal).toBe("deleted");
    expect(castingRows[0]?.deleted_at).not.toBeNull();

    const reservationRows = await sql<{ status: string }[]>`
      select status from entitlement_reservations where id = ${reservationId}
    `;
    expect(reservationRows).toEqual([{ status: "released" }]);
    const batchRows = await sql<{ quantity_available: number; quantity_reserved: number }[]>`
      select quantity_available, quantity_reserved from entitlement_batches where id = ${batchId}
    `;
    expect(batchRows).toEqual([{ quantity_available: 1, quantity_reserved: 0 }]);

    const userRows = await sql<{ email: string; name: string }[]>`
      select email, name from users where id = ${userId}
    `;
    expect(userRows[0]?.name).toBe("Deleted User");
    expect(userRows[0]?.email).not.toBe(`${suffix}@example.com`);
  });

  it("rejects stale leased failure writes when the persisted outbox lease token is NULL", async () => {
    const suffix = randomUUID();
    const userId = `cp5-outbox-fence-${suffix}`;
    await insertUser(userId, `${suffix}@example.com`);
    const { orderId } = await insertPaidCredit({ userId });
    const repository = new PostgresPaymentRepository(sql, {
      checkoutUrlKeys: "v1:test-secret-key-material-32-chars-long!",
    });
    const recorded = await repository.recordVerifiedEvent(makePaymentEvent(orderId, userId));

    await sql`
      update payment_webhook_inbox
      set status = 'processing', attempt_count = 1, last_error_code = null, updated_at = clock_timestamp()
      where id = ${recorded.inboxId}
    `;
    await sql`
      update payment_outbox
      set status = 'processing', attempt_count = 1, lease_token = null,
          lease_expires_at = null, last_error_code = null, updated_at = clock_timestamp()
      where inbox_id = ${recorded.inboxId}
    `;

    const failure = await repository.recordProcessingFailure(recorded.inboxId, {
      leaseToken: "stale-worker-token",
      errorCode: "NETWORK_TIMEOUT",
    });
    expect(failure).toEqual({ deadLetter: false, attemptCount: 1 });

    const rows = await sql<Array<never>>`
      select i.status as inbox_status, i.last_error_code as inbox_error,
             o.status as outbox_status, o.last_error_code as outbox_error,
             o.lease_token
      from payment_webhook_inbox i
      join payment_outbox o on o.inbox_id = i.id
      where i.id = ${recorded.inboxId}
    ` as Array<{
      inbox_status: string;
      inbox_error: string | null;
      outbox_status: string;
      outbox_error: string | null;
      lease_token: string | null;
    }>;
    expect(rows).toEqual([{
      inbox_status: "processing",
      inbox_error: null,
      outbox_status: "processing",
      outbox_error: null,
      lease_token: null,
    }]);
  });
});
