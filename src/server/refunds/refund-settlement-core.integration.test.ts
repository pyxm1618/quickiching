import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { PostgresRefundRepository } from "./postgres-refund-repository";
import { applyRefundSettlement } from "./refund-settlement-core";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql);
const refundRepository = new PostgresRefundRepository(sql);

async function dispatchedRefund() {
  const suffix = randomUUID();
  const userId = `settlement-user-${suffix}`;
  const orderId = randomUUID();
  const batchId = randomUUID();
  const providerOrderId = `ORD_${suffix}`;
  const providerPaymentId = `PAY_${suffix}`;
  await sql`
    insert into users (id, name, email, email_verified, created_at, updated_at)
    values (${userId}, 'Settlement User', ${`${suffix}@settlement.example.com`}, true, now(), now())
  `;
  await sql`
    insert into payment_orders (
      id, user_id, product_key, quantity, amount_minor, currency, request_id,
      provider, provider_environment, provider_product_id, provider_order_id,
      provider_payment_id, status, paid_at, created_at, updated_at
    ) values (
      ${orderId}, ${userId}, 'three', 3, 699, 'USD', ${`settlement-${suffix}`},
      'waffo', 'test', 'PROD_test_three', ${providerOrderId}, ${providerPaymentId},
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
  const intent = await refundRepository.apply({
    userId, orderId, reason: "Settlement test", now: new Date(),
  });
  await refundRepository.decide({
    refundId: intent.id, action: "approve", operatorId: "operator-test", now: new Date(),
  });
  const claim = await refundRepository.claimProviderDispatch(intent.id, new Date());
  expect(claim.mode).toBe("dispatch");
  return { userId, orderId, batchId, providerOrderId, providerPaymentId, refundId: intent.id };
}

function succeededInput(fixture: Awaited<ReturnType<typeof dispatchedRefund>>, source: "provider_read" | "webhook") {
  return {
    refundId: fixture.refundId,
    orderId: fixture.orderId,
    environment: "test" as const,
    providerOrderId: fixture.providerOrderId,
    providerPaymentId: fixture.providerPaymentId,
    amountMinor: 699,
    currency: "USD" as const,
    providerTicketId: "RT_shared",
    providerRefundId: source === "provider_read" ? "RF_shared" : null,
    status: "succeeded" as const,
    source,
    webhookInboxId: null,
    now: new Date(),
  };
}

describe("shared refund settlement core", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  });
  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("applies provider-read success exactly once across repeated reads", async () => {
    const fixture = await dispatchedRefund();
    await expect(applyRefundSettlement(sql, succeededInput(fixture, "provider_read")))
      .resolves.toMatchObject({ outcome: "succeeded" });
    await expect(applyRefundSettlement(sql, succeededInput(fixture, "provider_read")))
      .resolves.toMatchObject({ outcome: "already_settled" });

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
      where o.id = ${fixture.orderId}
    `;
    expect(rows[0]).toEqual({
      order_status: "refunded", refund_status: "succeeded",
      available: 0, revoked: 3, revoke_count: 1,
    });
  });

  it("is replay-safe when provider read wins before a late webhook", async () => {
    const fixture = await dispatchedRefund();
    await applyRefundSettlement(sql, succeededInput(fixture, "provider_read"));
    await expect(applyRefundSettlement(sql, succeededInput(fixture, "webhook")))
      .resolves.toMatchObject({ outcome: "already_settled" });
    const ledgers = await sql<{ count: number }[]>`
      select count(*)::int as count from entitlement_ledger
      where order_id = ${fixture.orderId} and action = 'revoke'
    `;
    expect(ledgers[0]?.count).toBe(1);
  });

  it("is replay-safe when webhook wins and a later provider read supplies settlement references", async () => {
    const fixture = await dispatchedRefund();
    await applyRefundSettlement(sql, succeededInput(fixture, "webhook"));
    await expect(applyRefundSettlement(sql, succeededInput(fixture, "provider_read")))
      .resolves.toMatchObject({ outcome: "already_settled" });
    const rows = await sql<Array<{ provider_ticket_id: string | null; provider_refund_id: string | null; count: number }>>`
      select r.provider_ticket_id, r.provider_refund_id,
        (select count(*)::int from entitlement_ledger l
          where l.order_id = r.order_id and l.action = 'revoke') as count
      from refund_intents r where r.id = ${fixture.refundId}
    `;
    expect(rows[0]).toEqual({ provider_ticket_id: "RT_shared", provider_refund_id: "RF_shared", count: 1 });
  });

  it("settles refund.failed without changing order or credits", async () => {
    const fixture = await dispatchedRefund();
    await expect(applyRefundSettlement(sql, {
      ...succeededInput(fixture, "webhook"),
      providerRefundId: null,
      status: "failed" as const,
    })).resolves.toMatchObject({ outcome: "failed" });
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
      where o.id = ${fixture.orderId}
    `;
    expect(rows[0]).toEqual({
      order_status: "paid", refund_status: "failed",
      available: 3, revoked: 0, revoke_count: 0,
    });
  });

  it("fails closed if credits changed after provider dispatch instead of revoking unrelated balance", async () => {
    const fixture = await dispatchedRefund();
    await sql`
      update entitlement_batches
      set quantity_available = 2, quantity_consumed = 1, updated_at = now()
      where id = ${fixture.batchId}
    `;
    await expect(applyRefundSettlement(sql, succeededInput(fixture, "provider_read")))
      .resolves.toMatchObject({ outcome: "financial_review" });
    const rows = await sql<Array<{
      order_status: string;
      refund_status: string;
      available: number;
      consumed: number;
      revoked: number;
      revoke_count: number;
    }>>`
      select o.status as order_status, r.status as refund_status,
        b.quantity_available::int as available, b.quantity_consumed::int as consumed,
        b.quantity_revoked::int as revoked,
        (select count(*)::int from entitlement_ledger l
          where l.order_id = o.id and l.action = 'revoke') as revoke_count
      from payment_orders o
      join refund_intents r on r.order_id = o.id
      join entitlement_batches b on b.order_id = o.id
      where o.id = ${fixture.orderId}
    `;
    expect(rows[0]).toEqual({
      order_status: "financial_review", refund_status: "reconciliation_required",
      available: 2, consumed: 1, revoked: 0, revoke_count: 0,
    });
  });
});
