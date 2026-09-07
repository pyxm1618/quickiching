import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { PostgresRefundRepository } from "./postgres-refund-repository";
import { PostgresRefundReconciliationRepository } from "./postgres-refund-reconciliation";
import { applyRefundSettlement } from "./refund-settlement-core";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql);
const refundRepository = new PostgresRefundRepository(sql);
const reconciliationRepository = new PostgresRefundReconciliationRepository(sql);

async function fixture() {
  const suffix = randomUUID();
  const userId = `refund-concurrency-user-${suffix}`;
  const orderId = randomUUID();
  const providerOrderId = `ORD_${suffix}`;
  const providerPaymentId = `PAY_${suffix}`;
  await sql`
    insert into users (id, name, email, email_verified, created_at, updated_at)
    values (${userId}, 'Refund Concurrency User', ${`${suffix}@refund-concurrency.example.com`}, true, now(), now())
  `;
  await sql`
    insert into payment_orders (
      id, user_id, product_key, quantity, amount_minor, currency, request_id,
      provider, provider_environment, provider_product_id, provider_order_id,
      provider_payment_id, status, paid_at, created_at, updated_at
    ) values (
      ${orderId}, ${userId}, 'three', 3, 699, 'USD', ${`refund-concurrency-${suffix}`},
      'waffo', 'test', 'PROD_test_three', ${providerOrderId}, ${providerPaymentId},
      'paid', now() - interval '1 day', now() - interval '1 day', now() - interval '1 day'
    )
  `;
  await sql`
    insert into entitlement_batches (
      id, user_id, order_id, quantity_total, quantity_available,
      quantity_reserved, quantity_consumed, quantity_revoked, expires_at,
      created_at, updated_at
    ) values (
      ${randomUUID()}, ${userId}, ${orderId}, 3, 3, 0, 0, 0,
      now() + interval '12 months', now(), now()
    )
  `;
  const intent = await refundRepository.apply({ userId, orderId, reason: "Concurrency test", now: new Date() });
  await refundRepository.decide({ refundId: intent.id, action: "approve", operatorId: "operator-test", now: new Date() });
  const dispatch = await refundRepository.claimProviderDispatch(intent.id, new Date());
  expect(dispatch.mode).toBe("dispatch");

  const claims = await reconciliationRepository.claimBatch({ limit: 10, now: new Date(), leaseDurationMs: 30_000 });
  const claim = claims.find((item) => item.refundId === intent.id);
  expect(claim).toBeDefined();
  if (!claim) throw new Error("REFUND_RECONCILE_TEST_CLAIM_MISSING");
  return { orderId, refundId: intent.id, providerOrderId, providerPaymentId, leaseToken: claim.leaseToken };
}

describe("concurrent refund webhook and provider-read reconciliation", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  });
  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("never deadlocks or applies a duplicate reversal", async () => {
    const item = await fixture();
    const common = {
      refundId: item.refundId,
      orderId: item.orderId,
      environment: "test" as const,
      providerOrderId: item.providerOrderId,
      providerPaymentId: item.providerPaymentId,
      amountMinor: 699,
      currency: "USD" as const,
      status: "succeeded" as const,
      now: new Date(),
    };

    const results = await Promise.allSettled([
      applyRefundSettlement(sql, {
        ...common,
        providerTicketId: "RT_concurrent",
        providerRefundId: "RF_concurrent",
        source: "provider_read",
        webhookInboxId: null,
        reconcileLeaseToken: item.leaseToken,
      }),
      applyRefundSettlement(sql, {
        ...common,
        providerTicketId: null,
        providerRefundId: null,
        source: "webhook",
        webhookInboxId: null,
      }),
    ]);

    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    for (const result of results) {
      if (result.status === "rejected") {
        expect(result.reason).toBeInstanceOf(Error);
        expect((result.reason as Error).message).toBe("REFUND_RECONCILE_LEASE_LOST");
      }
    }

    const rows = await sql<Array<{
      order_status: string;
      refund_status: string;
      available: number;
      revoked: number;
      revoke_count: number;
    }>>`
      select o.status as order_status, r.status as refund_status,
        b.quantity_available::int as available, b.quantity_revoked::int as revoked,
        (select count(*)::int from entitlement_ledger l
          where l.order_id = o.id and l.action = 'revoke') as revoke_count
      from payment_orders o
      join refund_intents r on r.order_id = o.id
      join entitlement_batches b on b.order_id = o.id
      where o.id = ${item.orderId}
    `;
    expect(rows[0]).toEqual({
      order_status: "refunded",
      refund_status: "succeeded",
      available: 0,
      revoked: 3,
      revoke_count: 1,
    });
  });
});
