import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { PostgresRefundRepository } from "./postgres-refund-repository";
import { PostgresRefundReconciliationRepository, REFUND_RECONCILE_MAX_ATTEMPTS } from "./postgres-refund-reconciliation";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
const sql = postgres(databaseURL, { max: 12, prepare: false });
const db = drizzle(sql);
const refunds = new PostgresRefundRepository(sql);
const reconciliation = new PostgresRefundReconciliationRepository(sql);

async function dispatchedRefund() {
  const suffix = randomUUID();
  const userId = `refund-reconcile-user-${suffix}`;
  const orderId = randomUUID();
  const batchId = randomUUID();
  await sql`
    insert into users (id, name, email, email_verified, created_at, updated_at)
    values (${userId}, 'Refund Reconcile User', ${`${suffix}@refund-reconcile.example.com`}, true, now(), now())
  `;
  await sql`
    insert into payment_orders (
      id, user_id, product_key, quantity, amount_minor, currency, request_id,
      provider, provider_environment, provider_product_id, provider_order_id,
      provider_payment_id, status, paid_at, created_at, updated_at
    ) values (
      ${orderId}, ${userId}, 'three', 3, 699, 'USD', ${`refund-reconcile-${suffix}`},
      'waffo', 'test', 'PROD_test_three', ${`ORD_${suffix}`}, ${`PAY_${suffix}`},
      'paid', ${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}, now(), now()
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
  const intent = await refunds.apply({ userId, orderId, reason: "Reconcile me", now: new Date() });
  await refunds.decide({ refundId: intent.id, action: "approve", operatorId: "operator-test", now: new Date() });
  const claim = await refunds.claimProviderDispatch(intent.id, new Date());
  expect(claim.mode).toBe("dispatch");
  await refunds.markProviderDispatchAmbiguous({
    refundId: intent.id,
    errorCode: "REFUND_PROVIDER_WRITE_OUTCOME_UNKNOWN",
    now: new Date(),
  });
  return { refundId: intent.id, orderId };
}

describe("PostgreSQL refund reconciliation claims", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  });
  beforeEach(async () => {
    // The serial suite intentionally shares one database across integration
    // files. Park any due refund candidates created by earlier tests so each
    // concurrency assertion observes only the fixture created in this test.
    await sql`
      update refund_intents
      set next_reconcile_at = now() + interval '1 hour'
      where status in ('processing', 'reconciliation_required')
        and provider_write_state in ('dispatched', 'confirmed', 'ambiguous')
        and provider_write_attempt_count = 1
    `;
  });
  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("allows only one concurrent worker to own a due refund reconciliation lease", async () => {
    const fixture = await dispatchedRefund();
    const now = new Date();
    const claims = await Promise.all(Array.from({ length: 8 }, () => (
      reconciliation.claimBatch({ limit: 1, leaseDurationMs: 30_000, now })
    )));
    const flat = claims.flat();
    expect(flat).toHaveLength(1);
    expect(flat[0]).toMatchObject({ refundId: fixture.refundId, reconcileAttemptCount: 1 });

    const rows = await sql<Array<{
      reconcile_attempt_count: number;
      reconcile_lease_token: string | null;
    }>>`
      select reconcile_attempt_count, reconcile_lease_token
      from refund_intents where id = ${fixture.refundId}
    `;
    expect(rows[0]?.reconcile_attempt_count).toBe(1);
    expect(rows[0]?.reconcile_lease_token).toBeTruthy();
  });

  it("reclaims an expired lease without ever changing provider_write_attempt_count", async () => {
    const fixture = await dispatchedRefund();
    const first = await reconciliation.claimBatch({ limit: 1, leaseDurationMs: 1000, now: new Date() });
    expect(first).toHaveLength(1);
    await sql`
      update refund_intents
      set reconcile_lease_expires_at = now() - interval '1 second', next_reconcile_at = now() - interval '1 second'
      where id = ${fixture.refundId}
    `;
    const second = await reconciliation.claimBatch({ limit: 1, leaseDurationMs: 1000, now: new Date() });
    expect(second).toHaveLength(1);
    expect(second[0]?.reconcileAttemptCount).toBe(2);

    const rows = await sql<Array<{
      provider_write_attempt_count: number;
      reconcile_attempt_count: number;
    }>>`
      select provider_write_attempt_count, reconcile_attempt_count
      from refund_intents where id = ${fixture.refundId}
    `;
    expect(rows[0]).toEqual({ provider_write_attempt_count: 1, reconcile_attempt_count: 2 });
  });

  it("fails closed to financial review at the reconciliation attempt cap", async () => {
    const fixture = await dispatchedRefund();
    await sql`
      update refund_intents
      set reconcile_attempt_count = ${REFUND_RECONCILE_MAX_ATTEMPTS},
          reconcile_lease_token = null,
          reconcile_lease_expires_at = null,
          next_reconcile_at = now() - interval '1 second'
      where id = ${fixture.refundId}
    `;

    await expect(reconciliation.claimBatch({ limit: 1, now: new Date() })).resolves.toEqual([]);
    const rows = await sql<Array<{
      order_status: string;
      refund_status: string;
      provider_write_attempt_count: number;
      last_error_code: string | null;
    }>>`
      select o.status as order_status, r.status as refund_status,
        r.provider_write_attempt_count, r.last_error_code
      from refund_intents r join payment_orders o on o.id = r.order_id
      where r.id = ${fixture.refundId}
    `;
    expect(rows[0]).toEqual({
      order_status: "financial_review",
      refund_status: "reconciliation_required",
      provider_write_attempt_count: 1,
      last_error_code: "REFUND_RECONCILE_MAX_ATTEMPTS",
    });
  });
});
