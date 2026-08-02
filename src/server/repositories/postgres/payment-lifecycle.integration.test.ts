import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";
import { PostgresPaymentRepository } from "./payment-repository";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;
const completed = { id: "delivery_1", timestamp: "2026-08-02T00:00:00.000Z", eventId: "PAY_1", eventType: "order.completed", storeId: "STO_test", mode: "test" as const, data: { orderId: "ORD_1", buyerEmail: "buyer@example.com", merchantProvidedBuyerIdentity: "usr_1", currency: "USD", amount: "2.99", subtotal: "2.99", total: "2.99", taxAmount: "0.00", productName: "One", paymentId: "PAY_1", orderMerchantExternalId: "ord_1", orderMetadata: { orderId: "ord_1", internalProductId: "one" } } };

describePostgres("Waffo payment lifecycle", () => {
  let sql: Sql;
  let repository: PostgresPaymentRepository;
  beforeAll(async () => { sql = postgres(databaseUrl!, { max: 1 }); await migratePostgres(sql); });
  beforeEach(async () => {
    await resetPostgresForTests(sql);
    await sql`insert into users (id, email) values ('usr_1', 'buyer@example.com')`;
    await sql`insert into orders (id, user_id, product_id, amount_usd, currency, request_id, buyer_email_snapshot) values ('ord_1', 'usr_1', 'one', 2.99, 'USD', 'req_1', 'buyer@example.com')`;
    repository = new PostgresPaymentRepository(sql, { products: { PROD_one: { internalProductId: "one", quantity: 1, amountUsd: 2.99 } } });
  });
  afterAll(async () => { await sql?.end(); });
  it("grants exactly once and does not grant from an unrecognized event", async () => {
    await repository.recordVerifiedDelivery(completed, completed);
    await expect(repository.dispatchPending()).resolves.toMatchObject({ dispatched: 1 });
    await repository.recordVerifiedDelivery(completed, completed);
    await expect(repository.dispatchPending()).resolves.toMatchObject({ dispatched: 0 });
    expect(await sql`select id from entitlement_ledger where action = 'grant'`).toHaveLength(1);
  });
  it("keeps an early refund retryable", async () => {
    const refund = { ...completed, id: "delivery_refund", eventId: "REF_1", eventType: "refund.succeeded", data: { ...completed.data, amount: "2.99" } };
    await repository.recordVerifiedDelivery(refund, refund);
    await expect(repository.dispatchPending()).resolves.toMatchObject({ failed: 1 });
  });

  it("dead-letters a permanent business mismatch on its first attempt", async () => {
    const invalid = { ...completed, id: "delivery_invalid", eventId: "PAY_invalid", data: { ...completed.data, merchantProvidedBuyerIdentity: "usr_other" } };
    await repository.recordVerifiedDelivery(invalid, invalid);
    await expect(repository.dispatchPending()).resolves.toMatchObject({ failed: 1 });
    expect((await sql`select attempts, dead_lettered_at from outbox where aggregate_id = 'delivery_invalid'`)[0])
      .toMatchObject({ attempts: 1 });
    expect((await sql`select dead_lettered_at from outbox where aggregate_id = 'delivery_invalid'`)[0].dead_lettered_at).not.toBeNull();
  });

  it("recovers an expired dispatcher lease without granting twice", async () => {
    await repository.recordVerifiedDelivery(completed, completed);
    await sql`update outbox set attempts = 1, available_at = now() - interval '1 second' where aggregate_id = 'delivery_1'`;
    await expect(repository.dispatchPending()).resolves.toMatchObject({ dispatched: 1 });
    await expect(repository.dispatchPending()).resolves.toMatchObject({ dispatched: 0 });
    expect(await sql`select id from entitlement_ledger where action = 'grant'`).toHaveLength(1);
  });

  it("does not duplicate an entitlement when two dispatchers race", async () => {
    const secondSql = postgres(databaseUrl!, { max: 1 });
    const second = new PostgresPaymentRepository(secondSql, { products: { PROD_one: { internalProductId: "one", quantity: 1, amountUsd: 2.99 } } });
    try {
      await repository.recordVerifiedDelivery(completed, completed);
      await Promise.all([repository.dispatchPending(), second.dispatchPending()]);
      expect(await sql`select id from entitlement_ledger where action = 'grant'`).toHaveLength(1);
      expect((await sql`select count(*)::integer as count from entitlement_batches where order_id = 'ord_1'`)[0].count).toBe(1);
    } finally {
      await secondSql.end();
    }
  });
});
