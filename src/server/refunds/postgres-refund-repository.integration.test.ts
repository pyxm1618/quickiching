import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { PostgresRefundRepository } from "./postgres-refund-repository";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
const sql = postgres(databaseURL, { max: 8, prepare: false });
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
  const paidAt = new Date(Date.now() - (input.ageDays ?? 1) * 24 * 60 * 60 * 1000).toISOString();
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
  return { userId, orderId, batchId };
}

async function approvedIntent() {
  const fixture = await paidOrder();
  const intent = await repository.apply({
    userId: fixture.userId,
    orderId: fixture.orderId,
    reason: "Refund please",
    now: new Date(),
  });
  await repository.decide({
    refundId: intent.id,
    action: "approve",
    operatorId: "operator-test",
    now: new Date(),
  });
  return { ...fixture, intentId: intent.id };
}

describe("refund application, operator decision, and provider dispatch fence", () => {
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

  it("allows exactly one concurrent worker to cross the durable provider-write fence", async () => {
    const fixture = await approvedIntent();
    const claims = await Promise.all(Array.from({ length: 8 }, () => (
      repository.claimProviderDispatch(fixture.intentId, new Date())
    )));

    expect(claims.filter((claim) => claim.mode === "dispatch")).toHaveLength(1);
    expect(claims.filter((claim) => claim.mode === "read_only")).toHaveLength(7);
    const rows = await sql<Array<{
      status: string;
      provider_write_state: string;
      provider_write_attempt_count: number;
    }>>`
      select status, provider_write_state, provider_write_attempt_count
      from refund_intents where id = ${fixture.intentId}
    `;
    expect(rows[0]).toEqual({
      status: "processing",
      provider_write_state: "dispatched",
      provider_write_attempt_count: 1,
    });
  });

  it("never reopens the write fence after an ambiguous provider outcome", async () => {
    const fixture = await approvedIntent();
    const first = await repository.claimProviderDispatch(fixture.intentId, new Date());
    expect(first.mode).toBe("dispatch");
    await repository.markProviderDispatchAmbiguous({
      refundId: fixture.intentId,
      errorCode: "REFUND_PROVIDER_WRITE_OUTCOME_UNKNOWN",
      now: new Date(),
    });
    const retry = await repository.claimProviderDispatch(fixture.intentId, new Date());
    expect(retry.mode).toBe("read_only");

    const rows = await sql<Array<{
      status: string;
      provider_write_state: string;
      provider_write_attempt_count: number;
    }>>`
      select status, provider_write_state, provider_write_attempt_count
      from refund_intents where id = ${fixture.intentId}
    `;
    expect(rows[0]).toEqual({
      status: "reconciliation_required",
      provider_write_state: "ambiguous",
      provider_write_attempt_count: 1,
    });
  });

  it("persists the provider ticket without treating a POST response as final settlement", async () => {
    const fixture = await approvedIntent();
    await repository.claimProviderDispatch(fixture.intentId, new Date());
    await repository.markProviderDispatchConfirmed({
      refundId: fixture.intentId,
      result: { providerTicketId: `RT_${randomUUID()}`, status: "succeeded" },
      now: new Date(),
    });
    const rows = await sql<Array<{
      status: string;
      provider_write_state: string;
      provider_write_attempt_count: number;
      provider_ticket_id: string | null;
    }>>`
      select status, provider_write_state, provider_write_attempt_count, provider_ticket_id
      from refund_intents where id = ${fixture.intentId}
    `;
    expect(rows[0]).toMatchObject({
      status: "processing",
      provider_write_state: "confirmed",
      provider_write_attempt_count: 1,
    });
    expect(rows[0]?.provider_ticket_id).toMatch(/^RT_/);
  });

  it("re-checks source credits after approval and blocks the provider write if they changed", async () => {
    const fixture = await approvedIntent();
    await sql`
      update entitlement_batches
      set quantity_available = quantity_available - 1,
          quantity_consumed = quantity_consumed + 1,
          updated_at = now()
      where id = ${fixture.batchId}
    `;

    await expect(repository.claimProviderDispatch(fixture.intentId, new Date()))
      .rejects.toThrow("REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE");
    const rows = await sql<Array<{
      status: string;
      auto_screen: string;
      provider_write_state: string;
      provider_write_attempt_count: number;
    }>>`
      select status, auto_screen, provider_write_state, provider_write_attempt_count
      from refund_intents where id = ${fixture.intentId}
    `;
    expect(rows[0]).toEqual({
      status: "manual_review",
      auto_screen: "manual_exception",
      provider_write_state: "not_started",
      provider_write_attempt_count: 0,
    });
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
