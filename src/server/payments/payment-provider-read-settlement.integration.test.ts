import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { applyAuthoritativePaymentSettlement } from "./payment-provider-read-settlement";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql);

async function checkoutFixture() {
  const suffix = randomUUID();
  const userId = `payment-recovery-user-${suffix}`;
  const orderId = randomUUID();
  await sql`
    insert into users (id, name, email, email_verified, created_at, updated_at)
    values (${userId}, 'Payment Recovery User', ${`${suffix}@payment-recovery.example.com`}, true, now(), now())
  `;
  await sql`
    insert into payment_orders (
      id, user_id, product_key, quantity, amount_minor, currency, request_id,
      provider, provider_environment, provider_product_id,
      provider_checkout_session_id, provider_checkout_url, checkout_expires_at,
      status, created_at, updated_at
    ) values (
      ${orderId}, ${userId}, 'three', 3, 699, 'USD', ${`payment-recovery-${suffix}`},
      'waffo', 'test', 'PROD_test_three',
      ${`CHK_${suffix}`}, ${`https://pancake.waffo.ai/#token=${suffix}`}, now() - interval '1 minute',
      'checkout_created', now() - interval '10 minutes', now() - interval '10 minutes'
    )
  `;
  return { userId, orderId };
}

function payment(orderId: string) {
  return {
    environment: "test" as const,
    storeId: "STO_test",
    model: "one_time" as const,
    merchantOrderReference: orderId,
    providerOrderId: `ORD_${orderId}`,
    providerPaymentId: `PAY_${orderId}`,
    providerProductId: "PROD_test_three",
    status: "succeeded" as const,
    amountMinor: 699,
    currency: "USD" as const,
  };
}

describe("authoritative one-time payment provider-read settlement", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  });
  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("grants source-bound credits exactly once without fabricating a webhook record", async () => {
    const fixture = await checkoutFixture();
    const input = { orderId: fixture.orderId, payment: payment(fixture.orderId), source: "provider_read_reconciliation" as const, now: new Date() };

    await expect(applyAuthoritativePaymentSettlement(sql, input)).resolves.toMatchObject({ outcome: "succeeded" });
    await expect(applyAuthoritativePaymentSettlement(sql, input)).resolves.toMatchObject({ outcome: "already_settled" });

    const rows = await sql<Array<{
      order_status: string;
      provider_order_id: string | null;
      provider_payment_id: string | null;
      available: number;
      grant_count: number;
      webhook_count: number;
    }>>`
      select o.status as order_status, o.provider_order_id, o.provider_payment_id,
        b.quantity_available::int as available,
        (select count(*)::int from entitlement_ledger l where l.order_id = o.id and l.action = 'grant') as grant_count,
        (select count(*)::int from payment_webhook_inbox i where i.linked_order_id = o.id) as webhook_count
      from payment_orders o join entitlement_batches b on b.order_id = o.id
      where o.id = ${fixture.orderId}
    `;
    expect(rows[0]).toEqual({
      order_status: "paid",
      provider_order_id: payment(fixture.orderId).providerOrderId,
      provider_payment_id: payment(fixture.orderId).providerPaymentId,
      available: 3,
      grant_count: 1,
      webhook_count: 0,
    });
  });

  it("fails closed on provider product mismatch and grants nothing", async () => {
    const fixture = await checkoutFixture();
    const mismatched = { ...payment(fixture.orderId), providerProductId: "PROD_wrong" };
    await expect(applyAuthoritativePaymentSettlement(sql, {
      orderId: fixture.orderId,
      payment: mismatched,
      source: "provider_read_reconciliation",
      now: new Date(),
    })).resolves.toMatchObject({ outcome: "financial_review" });

    const rows = await sql<Array<{ status: string; batches: number }>>`
      select o.status, (select count(*)::int from entitlement_batches b where b.order_id = o.id) as batches
      from payment_orders o where o.id = ${fixture.orderId}
    `;
    expect(rows[0]).toEqual({ status: "financial_review", batches: 0 });
  });
});
