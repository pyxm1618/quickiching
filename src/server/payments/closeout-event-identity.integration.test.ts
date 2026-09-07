import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { CloseoutPaymentRepository } from "./closeout-repository";
import { canonicalWaffoPayloadHash, type NormalizedWaffoWebhook } from "./waffo-webhook";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
const sql = postgres(databaseURL, { max: 12, prepare: false });
const db = drizzle(sql);
const repository = new CloseoutPaymentRepository(sql);

async function orderFixture() {
  const suffix = randomUUID();
  const userId = `closeout-event-user-${suffix}`;
  const orderId = randomUUID();
  await sql`
    insert into users (id, name, email, email_verified, created_at, updated_at)
    values (${userId}, 'Closeout Event User', ${`${suffix}@closeout-event.example.com`}, true, now(), now())
  `;
  await sql`
    insert into payment_orders (
      id, user_id, product_key, quantity, amount_minor, currency, request_id,
      provider, provider_environment, provider_product_id, status, created_at, updated_at
    ) values (
      ${orderId}, ${userId}, 'three', 3, 699, 'USD', ${`closeout-event-${suffix}`},
      'waffo', 'test', 'PROD_test_three', 'pending', now(), now()
    )
  `;
  return { userId, orderId };
}

function event(input: {
  fixture: Awaited<ReturnType<typeof orderFixture>>;
  eventId?: string;
  deliveryId?: string;
  eventType?: "order.completed" | "refund.failed";
}): NormalizedWaffoWebhook {
  const eventType = input.eventType ?? "order.completed";
  const value: NormalizedWaffoWebhook = {
    provider: "waffo",
    providerEnvironment: "test",
    deliveryId: input.deliveryId ?? randomUUID(),
    eventId: input.eventId ?? `EVT_${randomUUID()}`,
    eventType,
    storeId: "STO_test",
    orderMerchantExternalId: input.fixture.orderId,
    merchantProvidedBuyerIdentity: input.fixture.userId,
    internalOrderId: input.fixture.orderId,
    refundTicketMerchantExternalId: null,
    providerOrderId: `ORD_${input.fixture.orderId}`,
    providerPaymentId: `PAY_${input.fixture.orderId}`,
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
  value.canonicalPayloadSha256 = canonicalWaffoPayloadHash(value);
  return value;
}

describe("closeout webhook business-event identity", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("stores one business event and treats a redelivery of the same eventId as replay", async () => {
    const fixture = await orderFixture();
    const eventId = `EVT_${randomUUID()}`;
    const first = event({ fixture, eventId, deliveryId: `DEL_${randomUUID()}` });
    const replay = event({ fixture, eventId, deliveryId: `DEL_${randomUUID()}` });

    const recorded = await repository.recordVerifiedEvent(first);
    const duplicate = await repository.recordVerifiedEvent(replay);

    expect(recorded.duplicate).toBeNull();
    expect(duplicate).toEqual({ inboxId: recorded.inboxId, duplicate: "event" });
    const rows = await sql<{ count: number }[]>`
      select count(*)::int as count from payment_webhook_inbox
      where provider = 'waffo' and provider_environment = 'test' and event_id = ${eventId}
    `;
    expect(rows[0]?.count).toBe(1);
  });

  it("accepts distinct business eventIds even when Waffo reuses the same delivery id", async () => {
    const fixture = await orderFixture();
    const deliveryId = `DEL_${randomUUID()}`;
    const first = event({ fixture, eventId: `EVT_${randomUUID()}`, deliveryId });
    const second = event({ fixture, eventId: `EVT_${randomUUID()}`, deliveryId });

    await expect(repository.recordVerifiedEvent(first)).resolves.toMatchObject({ duplicate: null });
    await expect(repository.recordVerifiedEvent(second)).resolves.toMatchObject({ duplicate: null });
    const rows = await sql<{ count: number }[]>`
      select count(*)::int as count from payment_webhook_inbox
      where provider = 'waffo' and provider_environment = 'test' and delivery_id = ${deliveryId}
    `;
    expect(rows[0]?.count).toBe(2);
  });

  it("fails closed when the same business eventId is reused for a different event type", async () => {
    const fixture = await orderFixture();
    const eventId = `EVT_${randomUUID()}`;
    await repository.recordVerifiedEvent(event({ fixture, eventId, eventType: "order.completed" }));

    await expect(repository.recordVerifiedEvent(event({ fixture, eventId, eventType: "refund.failed" })))
      .rejects.toThrow("WEBHOOK_BUSINESS_EVENT_CONFLICT");

    const conflicts = await sql<{ count: number }[]>`
      select count(*)::int as count from payment_webhook_conflicts
      where provider = 'waffo' and provider_environment = 'test'
        and reason_code = 'WEBHOOK_BUSINESS_EVENT_CONFLICT'
        and existing_order_id = ${fixture.orderId}
    `;
    expect(conflicts[0]?.count).toBe(1);
    const orders = await sql<{ status: string }[]>`
      select status from payment_orders where id = ${fixture.orderId}
    `;
    expect(orders[0]?.status).toBe("financial_review");
  });

  it("freezes both local orders when one business eventId conflicts across two orders", async () => {
    const existing = await orderFixture();
    const incoming = await orderFixture();
    const eventId = `EVT_${randomUUID()}`;

    await repository.recordVerifiedEvent(event({ fixture: existing, eventId }));
    await expect(repository.recordVerifiedEvent(event({ fixture: incoming, eventId })))
      .rejects.toThrow("WEBHOOK_BUSINESS_EVENT_CONFLICT");

    const conflicts = await sql<Array<{ existing_order_id: string; incoming_order_id: string }>>`
      select existing_order_id, incoming_order_id from payment_webhook_conflicts
      where provider = 'waffo' and provider_environment = 'test'
        and reason_code = 'WEBHOOK_BUSINESS_EVENT_CONFLICT'
        and existing_order_id = ${existing.orderId}
        and incoming_order_id = ${incoming.orderId}
    `;
    expect(conflicts).toHaveLength(1);

    const orders = await sql<Array<{ id: string; status: string }>>`
      select id, status from payment_orders
      where id in (${existing.orderId}, ${incoming.orderId})
      order by id
    `;
    expect(orders).toHaveLength(2);
    expect(orders.map((row) => row.status)).toEqual(["financial_review", "financial_review"]);
  });

  it("lets exactly one concurrent recorder insert an eventId and treats all others as replay", async () => {
    const fixture = await orderFixture();
    const eventId = `EVT_${randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 8 }, () => (
      repository.recordVerifiedEvent(event({ fixture, eventId, deliveryId: `DEL_${randomUUID()}` }))
    )));

    expect(results.filter((result) => result.duplicate === null)).toHaveLength(1);
    expect(results.filter((result) => result.duplicate === "event")).toHaveLength(7);
    expect(new Set(results.map((result) => result.inboxId)).size).toBe(1);
    const rows = await sql<{ count: number }[]>`
      select count(*)::int as count from payment_webhook_inbox
      where provider = 'waffo' and provider_environment = 'test' and event_id = ${eventId}
    `;
    expect(rows[0]?.count).toBe(1);
  });
});
