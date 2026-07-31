import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";
import { PostgresPaymentRepository } from "./payment-repository";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("payment webhook privacy boundary", () => {
  let sql: Sql;
  let repository: PostgresPaymentRepository;

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 10 });
    await migratePostgres(sql);
  });

  beforeEach(async () => {
    await resetPostgresForTests(sql);
    await sql`insert into users (id, email) values ('usr_payment_privacy', 'private@example.com')`;
    await sql`
      insert into orders (id, user_id, product_id, amount_usd, currency, request_id, status)
      values ('ord_payment_privacy', 'usr_payment_privacy', 'one', 2.99, 'USD', 'req_payment_privacy', 'pending')
    `;
    repository = new PostgresPaymentRepository(sql, {
      products: {
        prod_one: { internalProductId: "one", quantity: 1, amountUsd: 2.99 },
      },
    });
  });

  afterAll(async () => {
    if (sql) await sql.end();
  });

  it("stores normalized financial evidence and associates it with the internal order", async () => {
    await repository.processEvent({
      eventId: "evt_payment_privacy",
      eventType: "checkout.completed",
      checkoutId: "checkout_payment_privacy",
      providerOrderId: "provider_order_payment_privacy",
      providerTransactionId: "provider_transaction_payment_privacy",
      requestId: "req_payment_privacy",
      providerProductId: "prod_one",
      amountMinor: 299,
      currency: "USD",
      occurredAt: new Date("2026-07-31T03:30:00.000Z"),
      payload: {
        customer: {
          email: "private@example.com",
          name: "Private Customer",
          address: "Sensitive address",
        },
        arbitraryProviderData: "must not persist",
      },
    });

    const inbox = (await sql`
      select order_id, payload from webhook_inbox
      where provider = 'creem' and event_id = 'evt_payment_privacy'
    `)[0];
    expect(inbox.order_id).toBe("ord_payment_privacy");
    expect(inbox.payload).toEqual({
      eventId: "evt_payment_privacy",
      eventType: "checkout.completed",
      providerOrderId: "provider_order_payment_privacy",
      providerTransactionId: "provider_transaction_payment_privacy",
      amountMinor: 299,
      currency: "USD",
      occurredAt: "2026-07-31T03:30:00.000Z",
      checkoutId: "checkout_payment_privacy",
      requestId: "req_payment_privacy",
      providerProductId: "prod_one",
    });
    expect(JSON.stringify(inbox.payload)).not.toContain("private@example.com");
    expect(JSON.stringify(inbox.payload)).not.toContain("Sensitive address");
  });
});
