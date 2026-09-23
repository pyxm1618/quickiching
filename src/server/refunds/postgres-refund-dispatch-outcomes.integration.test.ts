import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { PostgresRefundDispatchOutcomeRepository } from "./postgres-refund-dispatch-outcomes";
import { PostgresRefundRepository } from "./postgres-refund-repository";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
const sql = postgres(databaseURL, { max: 4, prepare: false });
const db = drizzle(sql);
const repository = new PostgresRefundRepository(sql);
const outcomes = new PostgresRefundDispatchOutcomeRepository(sql);

async function approvedIntent() {
  const suffix = randomUUID();
  const userId = `refund-outcome-user-${suffix}`;
  const orderId = randomUUID();
  const batchId = randomUUID();
  await sql`
    insert into users (id, name, email, email_verified, created_at, updated_at)
    values (${userId}, 'Refund Outcome User', ${`${suffix}@refund-outcome.example.com`}, true, now(), now())
  `;
  await sql`
    insert into payment_orders (
      id, user_id, product_key, quantity, amount_minor, currency, request_id,
      provider, provider_environment, provider_product_id, provider_order_id,
      provider_payment_id, status, paid_at, created_at, updated_at
    ) values (
      ${orderId}, ${userId}, 'three', 3, 699, 'USD', ${`refund-outcome-${suffix}`},
      'waffo', 'test', 'PROD_test_three', ${`ORD_${suffix}`},
      ${`PAY_${suffix}`}, 'paid', now() - interval '1 day', now(), now()
    )
  `;
  await sql`
    insert into entitlement_batches (
      id, user_id, order_id, quantity_total, quantity_available,
      quantity_reserved, quantity_consumed, quantity_revoked, expires_at,
      created_at, updated_at
    ) values (
      ${batchId}, ${userId}, ${orderId}, 3, 3, 0, 0, 0,
      now() + interval '12 months', now(), now()
    )
  `;
  const intent = await repository.apply({
    userId,
    orderId,
    reason: "Refund outcome test",
    now: new Date(),
  });
  await repository.decide({
    refundId: intent.id,
    action: "approve",
    operatorId: "operator-test",
    now: new Date(),
  });
  return { intentId: intent.id, orderId };
}

describe("refund provider write outcome persistence", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("reopens the durable fence only after a proven not-dispatched outcome", async () => {
    const fixture = await approvedIntent();
    expect((await repository.claimProviderDispatch(fixture.intentId, new Date())).mode).toBe("dispatch");

    await outcomes.releaseProviderDispatchNotSent({
      refundId: fixture.intentId,
      errorCode: "REFUND_PROVIDER_PREFLIGHT_FAILED",
      now: new Date(),
    });

    const rows = await sql<Array<{
      status: string;
      provider_write_state: string;
      provider_write_attempt_count: number;
      provider_dispatched_at: Date | null;
      next_reconcile_at: Date | null;
      last_error_code: string | null;
    }>>`
      select status, provider_write_state, provider_write_attempt_count,
             provider_dispatched_at, next_reconcile_at, last_error_code
      from refund_intents where id = ${fixture.intentId}
    `;
    expect(rows[0]).toMatchObject({
      status: "approved",
      provider_write_state: "not_started",
      provider_write_attempt_count: 0,
      provider_dispatched_at: null,
      next_reconcile_at: null,
      last_error_code: "REFUND_PROVIDER_PREFLIGHT_FAILED",
    });

    expect((await repository.claimProviderDispatch(fixture.intentId, new Date())).mode).toBe("dispatch");
  });

  it("makes a definite provider rejection terminal and never reopens the POST fence", async () => {
    const fixture = await approvedIntent();
    expect((await repository.claimProviderDispatch(fixture.intentId, new Date())).mode).toBe("dispatch");

    await outcomes.markProviderDispatchRejected({
      refundId: fixture.intentId,
      errorCode: "REFUND_PROVIDER_REJECTED",
      now: new Date(),
    });
    await outcomes.markProviderDispatchRejected({
      refundId: fixture.intentId,
      errorCode: "REFUND_PROVIDER_REJECTED",
      now: new Date(),
    });

    const rows = await sql<Array<{
      status: string;
      provider_write_state: string;
      provider_write_attempt_count: number;
      next_reconcile_at: Date | null;
      last_error_code: string | null;
    }>>`
      select status, provider_write_state, provider_write_attempt_count,
             next_reconcile_at, last_error_code
      from refund_intents where id = ${fixture.intentId}
    `;
    expect(rows[0]).toMatchObject({
      status: "failed",
      provider_write_state: "confirmed",
      provider_write_attempt_count: 1,
      next_reconcile_at: null,
      last_error_code: "REFUND_PROVIDER_REJECTED",
    });

    expect((await repository.claimProviderDispatch(fixture.intentId, new Date())).mode).toBe("read_only");
  });
});
