import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { PostgresRefundRepository } from "./postgres-refund-repository";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
const sql = postgres(databaseURL, { max: 4, prepare: false });
const db = drizzle(sql);
const repository = new PostgresRefundRepository(sql);

async function paidOrder(input: { consumed?: number; reserved?: number; ageDays?: number } = {}) {
  const suffix = randomUUID();
  const userId = `refund-user-${suffix}`;
  const orderId = randomUUID();
  const batchId = randomUUID();
  const consumed = input.consumed ?? 0;
  const reserved = input.reserved ?? 0;
  const available = 3 - consumed - reserved;
  const paidAt = new Date(Date.now() - (input.ageDays ?? 1) * 24 * 60 * 60 * 1000);
  await sql`
    insert into users (id, name, email, email_verified, created_at, updated_at)
    values (${userId}, 'Refund User', ${`${suffix}@refund.example.com`}, true, now(), now())
  `;
  await sql`
    insert into payment_orders (
      id, user_id, product_key, quantity, amount_minor, currency, request_id,
      provider, provider_environment, provider_product_id, provider_order_id,
      provider_payment_id, status, paid_at, created_at, updated_at
    ) values (
      ${orderId}, ${userId}, 'three', 3, 699, 'USD', ${`refund-${suffix}`},
      'waffo', 'test', 'PROD_test_three', ${`ORD_${suffix}`},
      ${`PAY_${suffix}`}, 'paid', ${paidAt}, now(), now()
    )
  `;
  await sql`
    insert into entitlement_batches (
      id, user_id, order_id, quantity_total, quantity_available,
      quantity_reserved, quantity_consumed, quantity_revoked, expires_at,
      created_at, updated_at
    ) values (
      ${batchId}, ${userId}, ${orderId}, 3, ${available}, ${reserved}, ${consumed}, 0,
      now() + interval '12 months', now(), now()
    )
  `;
  return { userId, orderId };
}

describe("refund application and operator decision", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("creates one durable full-refund intent and makes duplicate application idempotent", async () => {
    const fixture = await paidOrder();
    const first = await repository.apply({
      userId: fixture.userId,
      orderId: fixture.orderId,
      reason: "I changed my mind",
      now: new Date(),
    });
    const second = await repository.apply({
      userId: fixture.userId,
      orderId: fixture.orderId,
      reason: "duplicate browser retry",
      now: new Date(),
    });

    expect(first).toMatchObject({ created: true, status: "manual_review", autoScreen: "clear", requestedMinor: 699 });
    expect(second).toMatchObject({ created: false, id: first.id, status: "manual_review" });
    const rows = await sql<{ count: string; correlation_ok: boolean }[]>`
      select count(*)::text as count,
        bool_and(refund_ticket_merchant_external_id = id::text) as correlation_ok
      from refund_intents where order_id = ${fixture.orderId}
    `;
    expect(rows[0]).toEqual({ count: "1", correlation_ok: true });
  });

  it("approves only a clear manual-review intent and never dispatches from the decision", async () => {
    const fixture = await paidOrder();
    const intent = await repository.apply({
      userId: fixture.userId,
      orderId: fixture.orderId,
      reason: "Refund please",
      now: new Date(),
    });
    const approved = await repository.decide({
      refundId: intent.id,
      action: "approve",
      operatorId: "operator-test",
      note: "approved",
      now: new Date(),
    });
    const replay = await repository.decide({
      refundId: intent.id,
      action: "approve",
      operatorId: "operator-test",
      note: "approved again",
      now: new Date(),
    });

    expect(approved.status).toBe("approved");
    expect(replay.status).toBe("approved");
    const rows = await sql<Array<{ provider_write_state: string; provider_write_attempt_count: number }>>`
      select provider_write_state, provider_write_attempt_count
      from refund_intents where id = ${intent.id}
    `;
    expect(rows[0]).toEqual({ provider_write_state: "not_started", provider_write_attempt_count: 0 });
  });

  it("keeps partially used source credits in manual exception and blocks provider approval", async () => {
    const fixture = await paidOrder({ consumed: 1 });
    const intent = await repository.apply({
      userId: fixture.userId,
      orderId: fixture.orderId,
      reason: "Refund after use",
      now: new Date(),
    });
    expect(intent).toMatchObject({ autoScreen: "manual_exception", status: "manual_review" });
    await expect(repository.decide({
      refundId: intent.id,
      action: "approve",
      operatorId: "operator-test",
      now: new Date(),
    })).rejects.toThrow("REFUND_MANUAL_EXCEPTION_REQUIRES_POLICY_DECISION");
  });

  it("durably rejects an application outside the seven-day window", async () => {
    const fixture = await paidOrder({ ageDays: 8 });
    const intent = await repository.apply({
      userId: fixture.userId,
      orderId: fixture.orderId,
      reason: "Too late",
      now: new Date(),
    });
    expect(intent).toMatchObject({
      status: "rejected",
      autoScreen: "rejected",
      screenReason: "REFUND_WINDOW_EXPIRED",
    });
  });
});
