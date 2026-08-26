import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { databaseSchema } from "@/server/db/schema";
import { createDeepReadingService, DeepReadingService } from "./deep-reading-service";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");

const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql, { schema: databaseSchema });

describe("CP5C Paid Deep Reading Service & Entitlement Flow (PostgreSQL)", () => {
  let deepReadingService: DeepReadingService;
  const userOneId = "cp5-deep-user-1";
  const userTwoId = "cp5-deep-user-2";
  const userZeroId = "cp5-deep-user-zero";

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
    deepReadingService = createDeepReadingService({
      sql,
      workflowStarter: {
        startDeepReadingWorkflow: async () => ({ runId: "mock-run-1", started: true }),
      },
    });

    const now = new Date().toISOString();
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values
        (${userOneId}, 'Deep User 1', 'deep1@example.com', true, ${now}, ${now}),
        (${userTwoId}, 'Deep User 2', 'deep2@example.com', true, ${now}, ${now}),
        (${userZeroId}, 'Deep User Zero', 'zero@example.com', true, ${now}, ${now})
      on conflict (id) do nothing
    `;
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("reserves entitlement credit atomically and starts deep reading workflow (NEG-07, NEG-08)", async () => {
    const orderId = randomUUID();
    const batchId = randomUUID();
    const castingId = randomUUID();
    const now = new Date().toISOString();

    // 1. Grant 1 credit to userOne
    await sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, provider_order_id, provider_payment_id,
        status, paid_at, created_at, updated_at
      ) values (${orderId}, ${userOneId}, 'one', 1, 299, 'USD', ${`req-${orderId}`}, 'waffo', 'test', 'prod-1', ${`ord-${orderId}`}, ${`pay-${orderId}`}, 'paid', ${now}, ${now}, ${now})
    `;
    await sql`
      insert into entitlement_batches (
        id, user_id, order_id, quantity_total, quantity_available, quantity_reserved, quantity_consumed, quantity_revoked, expires_at, created_at, updated_at
      ) values (${batchId}, ${userOneId}, ${orderId}, 1, 1, 0, 0, 0, now() + interval '12 months', ${now}, ${now})
    `;

    // 2. Create casting session for userOne
    await sql`
      insert into casting_sessions (id, user_id, method, lifecycle, risk_status, scene, interpretation_goal, created_at, updated_at)
      values (${castingId}, ${userOneId}, 'three_coin', 'revealed', 'allowed', 'career', 'guidance', ${now}, ${now})
    `;
    await sql`
      insert into cast_results (
        casting_id, line_values, primary_hexagram_number, moving_line_positions, relating_hexagram_number,
        method_calculation, algorithm_version, classic_mapping_version, result_hmac, result_hmac_key_version, created_at
      ) values (
        ${castingId}, ARRAY[7,8,7,8,7,8]::integer[], 11, ARRAY[]::integer[], null,
        '{"coins":[2,2,3]}'::jsonb, 'three-coin-v1', 'king-wen-v1', 'hmac-1', 'v1', ${now}
      )
    `;

    // 3. Request deep reading
    const result = await deepReadingService.requestDeepReading({
      userId: userOneId,
      castingId,
    });

    expect(result.status).toBe("queued");
    expect(result.jobId).toBeDefined();
    expect(result.reservationId).toBeDefined();

    // Verify batch reserved
    const batchRows = await sql<{ quantity_available: number; quantity_reserved: number }[]>`
      select quantity_available, quantity_reserved from entitlement_batches where id = ${batchId}
    `;
    expect(batchRows[0]?.quantity_available).toBe(0);
    expect(batchRows[0]?.quantity_reserved).toBe(1);

    // Verify reservation created
    const resRows = await sql<{ status: string; user_id: string }[]>`
      select status, user_id from entitlement_reservations where id = ${result.reservationId}
    `;
    expect(resRows[0]?.status).toBe("reserved");
    expect(resRows[0]?.user_id).toBe(userOneId);
  });

  it("fails closed with 404 when user tries to access another user's casting (NEG-10)", async () => {
    const castingId = randomUUID();
    const now = new Date().toISOString();

    // Casting owned by userTwo
    await sql`
      insert into casting_sessions (id, user_id, method, lifecycle, risk_status, scene, interpretation_goal, created_at, updated_at)
      values (${castingId}, ${userTwoId}, 'three_coin', 'revealed', 'allowed', 'career', 'guidance', ${now}, ${now})
    `;

    // UserOne requests deep reading for UserTwo's casting -> throws not found
    await expect(deepReadingService.requestDeepReading({
      userId: userOneId,
      castingId,
    })).rejects.toThrow("CASTING_NOT_FOUND");
  });

  it("throws INSUFFICIENT_CREDITS when user has 0 credits", async () => {
    const castingId = randomUUID();
    const now = new Date().toISOString();

    await sql`
      insert into casting_sessions (id, user_id, method, lifecycle, risk_status, scene, interpretation_goal, created_at, updated_at)
      values (${castingId}, ${userZeroId}, 'three_coin', 'revealed', 'allowed', 'career', 'guidance', ${now}, ${now})
    `;

    // userZeroId has 0 entitlement batches/credits
    await expect(deepReadingService.requestDeepReading({
      userId: userZeroId,
      castingId,
    })).rejects.toThrow("INSUFFICIENT_CREDITS");
  });

  it("enforces soft-delete write fence: rejects requests for soft-deleted castings (NEG-09)", async () => {
    const orderId = randomUUID();
    const batchId = randomUUID();
    const castingId = randomUUID();
    const now = new Date().toISOString();

    await sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, provider_order_id, provider_payment_id,
        status, paid_at, created_at, updated_at
      ) values (${orderId}, ${userOneId}, 'one', 1, 299, 'USD', ${`req-${orderId}`}, 'waffo', 'test', 'prod-1', ${`ord-${orderId}`}, ${`pay-${orderId}`}, 'paid', ${now}, ${now}, ${now})
    `;
    await sql`
      insert into entitlement_batches (
        id, user_id, order_id, quantity_total, quantity_available, quantity_reserved, quantity_consumed, quantity_revoked, expires_at, created_at, updated_at
      ) values (${batchId}, ${userOneId}, ${orderId}, 1, 1, 0, 0, 0, now() + interval '12 months', ${now}, ${now})
    `;

    // Insert casting with deleted_at set (soft-deleted)
    await sql`
      insert into casting_sessions (id, user_id, method, lifecycle, risk_status, scene, interpretation_goal, deleted_at, created_at, updated_at)
      values (${castingId}, ${userOneId}, 'three_coin', 'revealed', 'allowed', 'career', 'guidance', clock_timestamp(), ${now}, ${now})
    `;

    // Must be rejected as casting is soft-deleted
    await expect(deepReadingService.requestDeepReading({
      userId: userOneId,
      castingId,
    })).rejects.toThrow("CASTING_NOT_FOUND");
  });
});
