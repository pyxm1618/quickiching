import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { databaseSchema } from "@/server/db/schema";
import { createPostgresAccountRepository, PostgresAccountRepository } from "./postgres-repository";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");

const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql, { schema: databaseSchema });

describe("CP5D PostgreSQL Account & Privacy Boundaries (Integration)", () => {
  let accountRepository: PostgresAccountRepository;
  const userOneId = "cp5-acc-user-1";
  const userTwoId = "cp5-acc-user-2";

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
    accountRepository = createPostgresAccountRepository({ sql });

    const now = new Date().toISOString();
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values
        (${userOneId}, 'Account User 1', 'acc1@example.com', true, ${now}, ${now}),
        (${userTwoId}, 'Account User 2', 'acc2@example.com', true, ${now}, ${now})
      on conflict (id) do nothing
    `;
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("returns strictly scoped account summary without exposing other users' data (NEG-10)", async () => {
    const orderOneId = randomUUID();
    const orderTwoId = randomUUID();
    const batchOneId = randomUUID();
    const castingOneId = randomUUID();
    const castingTwoId = randomUUID();
    const now = new Date().toISOString();

    // User 1 order & batch & casting
    await sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, provider_order_id, provider_payment_id,
        status, paid_at, created_at, updated_at
      ) values (${orderOneId}, ${userOneId}, 'three', 3, 699, 'USD', ${`req-${orderOneId}`}, 'waffo', 'test', 'prod-3', ${`ord-${orderOneId}`}, ${`pay-${orderOneId}`}, 'paid', ${now}, ${now}, ${now})
    `;
    await sql`
      insert into entitlement_batches (
        id, user_id, order_id, quantity_total, quantity_available, quantity_reserved, quantity_consumed, quantity_revoked, expires_at, created_at, updated_at
      ) values (${batchOneId}, ${userOneId}, ${orderOneId}, 3, 3, 0, 0, 0, now() + interval '12 months', ${now}, ${now})
    `;
    await sql`
      insert into casting_sessions (id, user_id, method, lifecycle, risk_status, scene, interpretation_goal, created_at, updated_at)
      values (${castingOneId}, ${userOneId}, 'three_coin', 'revealed', 'allowed', 'career', 'guidance', ${now}, ${now})
    `;

    // User 2 order & casting
    await sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, provider_order_id, provider_payment_id,
        status, paid_at, created_at, updated_at
      ) values (${orderTwoId}, ${userTwoId}, 'one', 1, 299, 'USD', ${`req-${orderTwoId}`}, 'waffo', 'test', 'prod-1', ${`ord-${orderTwoId}`}, ${`pay-${orderTwoId}`}, 'paid', ${now}, ${now}, ${now})
    `;
    await sql`
      insert into casting_sessions (id, user_id, method, lifecycle, risk_status, scene, interpretation_goal, created_at, updated_at)
      values (${castingTwoId}, ${userTwoId}, 'three_coin', 'revealed', 'allowed', 'career', 'guidance', ${now}, ${now})
    `;

    const summary = await accountRepository.getAccountSummary(userOneId);
    expect(summary.user.email).toBe("acc1@example.com");
    expect(summary.credits.available).toBe(3);
    expect(summary.orders.length).toBe(1);
    expect(summary.orders[0]?.id).toBe(orderOneId);
    expect(summary.castings.length).toBe(1);
    expect(summary.castings[0]?.id).toBe(castingOneId);
  });

  it("soft-deletes all casting history and revokes sessions upon account deletion (NEG-09, NEG-11)", async () => {
    const deleteUserId = "cp5-acc-delete-user";
    const castingId = randomUUID();
    const sessionId = randomUUID();
    const now = new Date().toISOString();

    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (${deleteUserId}, 'To Delete', 'todelete@example.com', true, ${now}, ${now})
    `;
    await sql`
      insert into sessions (id, token, user_id, expires_at, created_at, updated_at)
      values (${sessionId}, ${`tok-${sessionId}`}, ${deleteUserId}, now() + interval '1 day', ${now}, ${now})
    `;
    await sql`
      insert into casting_sessions (id, user_id, method, lifecycle, risk_status, scene, interpretation_goal, created_at, updated_at)
      values (${castingId}, ${deleteUserId}, 'three_coin', 'revealed', 'allowed', 'career', 'guidance', ${now}, ${now})
    `;

    // Perform account deletion
    const result = await accountRepository.deleteAccount(deleteUserId);
    expect(result.success).toBe(true);

    // Verify casting is soft-deleted
    const castingRows = await sql<{ deleted_at: string | null }[]>`
      select deleted_at from casting_sessions where id = ${castingId}
    `;
    expect(castingRows[0]?.deleted_at).not.toBeNull();

    // Verify session is deleted
    const sessionRows = await sql<{ id: string }[]>`
      select id from sessions where user_id = ${deleteUserId}
    `;
    expect(sessionRows.length).toBe(0);

    // Verify audit event recorded
    const auditRows = await sql<{ action: string; category: string }[]>`
      select action, category from audit_events where category = 'deletion' and action = 'account_deleted' and user_id is null and entity_id is null order by created_at desc limit 1
    `;
    expect(auditRows[0]?.category).toBe("deletion");
    expect(auditRows[0]?.action).toBe("account_deleted");
  });

  it("returns the account-page overview scoped to one user, excluding deleted castings", async () => {
    const overviewUserId = "cp5-acc-overview-user";
    const otherOrderId = randomUUID();
    const activeOrderId = randomUUID();
    const expiringOrderId = randomUUID();
    const expiredOrderId = randomUUID();
    const activeBatchId = randomUUID();
    const expiringBatchId = randomUUID();
    const expiredBatchId = randomUUID();
    const revealedCastingId = randomUUID();
    const deletedCastingId = randomUUID();
    const now = new Date().toISOString();

    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (${overviewUserId}, 'Overview User', 'overview@example.com', true, ${now}, ${now})
    `;
    // A batch's quantity_total is trigger-bound to its order's quantity, and
    // product_key/quantity/amount_minor are check-bound as a fixed tuple.
    await sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, provider_order_id, provider_payment_id,
        status, paid_at, created_at, updated_at
      ) values
        (${activeOrderId}, ${overviewUserId}, 'three', 3, 699, 'USD', ${`req-${activeOrderId}`}, 'waffo', 'test', 'prod-3', ${`ord-${activeOrderId}`}, ${`pay-${activeOrderId}`}, 'paid', ${now}, ${now}, ${now}),
        (${expiringOrderId}, ${overviewUserId}, 'one', 1, 299, 'USD', ${`req-${expiringOrderId}`}, 'waffo', 'test', 'prod-1', ${`ord-${expiringOrderId}`}, ${`pay-${expiringOrderId}`}, 'paid', ${now}, ${now}, ${now}),
        (${expiredOrderId}, ${overviewUserId}, 'five', 5, 999, 'USD', ${`req-${expiredOrderId}`}, 'waffo', 'test', 'prod-5', ${`ord-${expiredOrderId}`}, ${`pay-${expiredOrderId}`}, 'paid', ${now}, ${now}, ${now})
    `;
    // 3 available far out, 1 available inside the 30-day window, 5 already expired.
    await sql`
      insert into entitlement_batches (
        id, user_id, order_id, quantity_total, quantity_available, quantity_reserved, quantity_consumed, quantity_revoked, expires_at, created_at, updated_at
      ) values
        (${activeBatchId}, ${overviewUserId}, ${activeOrderId}, 3, 3, 0, 0, 0, now() + interval '12 months', ${now}, ${now}),
        (${expiringBatchId}, ${overviewUserId}, ${expiringOrderId}, 1, 1, 0, 0, 0, now() + interval '10 days', ${now}, ${now}),
        (${expiredBatchId}, ${overviewUserId}, ${expiredOrderId}, 5, 5, 0, 0, 0, now() - interval '1 day', ${now}, ${now})
    `;
    await sql`
      insert into casting_sessions (id, user_id, method, lifecycle, risk_status, scene, interpretation_goal, created_at, updated_at, deleted_at)
      values
        (${revealedCastingId}, ${overviewUserId}, 'three_coin', 'revealed', 'allowed', 'career', 'guidance', ${now}, ${now}, null),
        (${deletedCastingId}, ${overviewUserId}, 'yarrow', 'revealed', 'allowed', 'career', 'guidance', ${now}, ${now}, ${now})
    `;
    await sql`
      insert into cast_results (
        casting_id, line_values, primary_hexagram_number, moving_line_positions, relating_hexagram_number,
        method_calculation, algorithm_version, classic_mapping_version, result_hmac, result_hmac_key_version, created_at
      ) values (
        ${revealedCastingId}, ARRAY[7,8,7,8,7,8]::integer[], 11, ARRAY[]::integer[], null,
        '{}'::jsonb, 'v1', 'v1', 'hmac', 'v1', ${now}
      )
    `;
    // Another user's batch must never leak into this overview.
    await sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, provider_order_id, provider_payment_id,
        status, paid_at, created_at, updated_at
      ) values (${otherOrderId}, ${userTwoId}, 'one', 1, 299, 'USD', ${`req-${otherOrderId}`}, 'waffo', 'test', 'prod-1', ${`ord-${otherOrderId}`}, ${`pay-${otherOrderId}`}, 'paid', ${now}, ${now}, ${now})
    `;
    await sql`
      insert into entitlement_batches (
        id, user_id, order_id, quantity_total, quantity_available, quantity_reserved, quantity_consumed, quantity_revoked, expires_at, created_at, updated_at
      ) values (${randomUUID()}, ${userTwoId}, ${otherOrderId}, 1, 1, 0, 0, 0, now() + interval '12 months', ${now}, ${now})
    `;

    const overview = await accountRepository.getAccountOverview(overviewUserId);

    expect(overview.credits.available).toBe(4);
    expect(overview.credits.expiringSoon).toBe(1);
    expect(overview.history.map((entry) => entry.id)).toEqual([revealedCastingId]);
    expect(overview.history[0]?.primaryHexagramNumber).toBe(11);
    expect(overview.history[0]?.hasPreview).toBe(false);
    expect(overview.history[0]?.hasReading).toBe(false);
  });

  it("reports a zeroed overview for a user with no orders or castings", async () => {
    const emptyUserId = "cp5-acc-empty-user";
    const now = new Date().toISOString();
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (${emptyUserId}, 'Empty User', 'empty@example.com', true, ${now}, ${now})
    `;

    const overview = await accountRepository.getAccountOverview(emptyUserId);

    expect(overview.credits).toEqual({ available: 0, expiringSoon: 0 });
    expect(overview.history).toEqual([]);
  });
});
