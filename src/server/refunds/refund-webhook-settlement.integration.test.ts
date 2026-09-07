import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { CloseoutPaymentRepository } from "@/server/payments/closeout-repository";
import { canonicalWaffoPayloadHash, type NormalizedWaffoWebhook } from "@/server/payments/waffo-webhook";
import { PostgresRefundRepository } from "./postgres-refund-repository";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql);
const paymentRepository = new CloseoutPaymentRepository(sql);
const refundRepository = new PostgresRefundRepository(sql);

async function paidRefundFixture() {
  const suffix = randomUUID();
  const userId = `refund-webhook-user-${suffix}`;
  const orderId = randomUUID();
  const batchId = randomUUID();
  const providerOrderId = `ORD_${suffix}`;
  const providerPaymentId = `PAY_${suffix}`;
  await sql`
    insert into users (id, name, email, email_verified, created_at, updated_at)
    values (${userId}, 'Refund Webhook User', ${`${suffix}@refund-webhook.example.com`}, true, now(), now())
  `;
  await sql`
    insert into payment_orders (
      id, user_id, product_key, quantity, amount_minor, currency, request_id,
      provider, provider_environment, provider_product_id, provider_order_id,
      provider_payment_id, status, paid_at, created_at, updated_at
    ) values (
      ${orderId}, ${userId}, 'three', 3, 699, 'USD', ${`refund-webhook-${suffix}`},
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
  const intent = await refundRepository.apply({ userId, orderId, reason: "Webhook settlement", now: new Date() });
  await refundRepository.decide({ refundId: intent.id, action: "approve", operatorId: "operator-test", now: new Date() });
  const claim = await refundRepository.claimProviderDispatch(intent.id, new Date());
  expect(claim.mode).toBe("dispatch");
  return { userId, orderId, providerOrderId, providerPaymentId, refundId: intent.id };
}

function refundEvent(
  fixture: Awaited<ReturnType<typeof paidRefundFixture>>,
  eventType: "refund.succeeded" | "refund.failed",
): NormalizedWaffoWebhook {
  const event: NormalizedWaffoWebhook = {
    provider: "waffo",
    providerEnvironment: "test",
    deliveryId: randomUUID(),
    eventId: `RF_${randomUUID()}`,
    eventType,
    storeId: "STO_test",
    orderMerchantExternalId: fixture.orderId,
    merchantProvidedBuyerIdentity: fixture.userId,
    internalOrderId: fixture.orderId,
    refundTicketMerchantExternalId: fixture.refundId,
    providerOrderId: fixture.providerOrderId,
    providerPaymentId: fixture.providerPaymentId,
    productKey: "three",
    providerProductId: "PROD_test_three",
    currency: "USD",
    amountMinor: 699,
    taxAmount: "0.00",
    total: "6.99",
    payloadSha256: randomUUID().replaceAll("-", "").padEnd(64, "0").slice(0, 64),
    canonicalPayloadSha256: "",
    supported: true,
    manualReviewReason: null,
  };
  event.canonicalPayloadSha256 = canonicalWaffoPayloadHash(event);
  return event;
}

describe("refund webhook shared settlement integration", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  });
  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("routes refund.succeeded through the shared refund intent settlement", async () => {
    const fixture = await paidRefundFixture();
    const event = refundEvent(fixture, "refund.succeeded");
    const recorded = await paymentRepository.recordVerifiedEvent(event);
    const result = await paymentRepository.processInbox(recorded.inboxId);
    expect(result.outcome).toBe("revoked");

    const rows = await sql<Array<{
      order_status: string;
      refund_status: string;
      provider_refund_id: string | null;
      revoke_count: number;
    }>>`
      select o.status as order_status, r.status as refund_status, r.provider_refund_id,
        (select count(*)::int from entitlement_ledger l
          where l.order_id = o.id and l.action = 'revoke') as revoke_count
      from payment_orders o
      join refund_intents r on r.order_id = o.id
      where o.id = ${fixture.orderId}
    `;
    expect(rows[0]).toEqual({
      order_status: "refunded",
      refund_status: "succeeded",
      provider_refund_id: null,
      revoke_count: 1,
    });
  });

  it("routes refund.failed through the same core without revoking credits", async () => {
    const fixture = await paidRefundFixture();
    const event = refundEvent(fixture, "refund.failed");
    const recorded = await paymentRepository.recordVerifiedEvent(event);
    const result = await paymentRepository.processInbox(recorded.inboxId);
    expect(result.outcome).toBe("ignored");

    const rows = await sql<Array<{
      order_status: string;
      refund_status: string;
      available: number;
      revoked: number;
    }>>`
      select o.status as order_status, r.status as refund_status,
        b.quantity_available::int as available, b.quantity_revoked::int as revoked
      from payment_orders o
      join refund_intents r on r.order_id = o.id
      join entitlement_batches b on b.order_id = o.id
      where o.id = ${fixture.orderId}
    `;
    expect(rows[0]).toEqual({
      order_status: "paid",
      refund_status: "failed",
      available: 3,
      revoked: 0,
    });
  });

  it("keeps a terminal failed refund terminal when a contradictory success webhook arrives", async () => {
    const fixture = await paidRefundFixture();
    const failed = refundEvent(fixture, "refund.failed");
    const failedRecord = await paymentRepository.recordVerifiedEvent(failed);
    await expect(paymentRepository.processInbox(failedRecord.inboxId))
      .resolves.toMatchObject({ outcome: "ignored" });

    const succeeded = refundEvent(fixture, "refund.succeeded");
    const succeededRecord = await paymentRepository.recordVerifiedEvent(succeeded);
    await expect(paymentRepository.processInbox(succeededRecord.inboxId))
      .resolves.toMatchObject({ outcome: "financial_review" });

    const rows = await sql<Array<{
      order_status: string;
      refund_status: string;
      last_error_code: string | null;
      available: number;
      revoked: number;
      revoke_count: number;
    }>>`
      select o.status as order_status, r.status as refund_status, r.last_error_code,
        b.quantity_available::int as available, b.quantity_revoked::int as revoked,
        (select count(*)::int from entitlement_ledger l
          where l.order_id = o.id and l.action = 'revoke') as revoke_count
      from payment_orders o
      join refund_intents r on r.order_id = o.id
      join entitlement_batches b on b.order_id = o.id
      where o.id = ${fixture.orderId}
    `;
    expect(rows[0]).toEqual({
      order_status: "financial_review",
      refund_status: "failed",
      last_error_code: "REFUND_SETTLEMENT_STATUS_CONFLICT",
      available: 3,
      revoked: 0,
      revoke_count: 0,
    });
  });
});
