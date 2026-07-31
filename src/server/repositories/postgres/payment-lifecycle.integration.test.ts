import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";
import { PostgresPaymentRepository, type CheckoutCompletedEvent } from "./payment-repository";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;
const paidAt = new Date("2026-07-31T03:00:00.000Z");

function checkoutEvent(): CheckoutCompletedEvent {
  return {
    eventId: "evt_checkout_lifecycle",
    eventType: "checkout.completed",
    checkoutId: "ch_lifecycle",
    providerOrderId: "provider_order_lifecycle",
    providerTransactionId: "tran_lifecycle",
    requestId: "request_lifecycle",
    providerProductId: "prod_five",
    amountMinor: 999,
    currency: "USD",
    occurredAt: paidAt,
    payload: { id: "evt_checkout_lifecycle" },
  };
}

describePostgres("Creem payment lifecycle", () => {
  let sql: Sql;
  let repository: PostgresPaymentRepository;

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 10 });
    await migratePostgres(sql);
  });

  beforeEach(async () => {
    await resetPostgresForTests(sql);
    await sql`insert into users (id, email) values ('usr_payment_lifecycle', 'payments@example.com')`;
    await sql`
      insert into orders (
        id, user_id, product_id, amount_usd, currency, request_id, status
      ) values (
        'ord_payment_lifecycle', 'usr_payment_lifecycle', 'five', 9.99, 'USD',
        'request_lifecycle', 'pending'
      )
    `;
    repository = new PostgresPaymentRepository(sql, {
      products: {
        prod_five: { internalProductId: "five", quantity: 5, amountUsd: 9.99 },
      },
    });
  });

  afterAll(async () => {
    if (sql) await sql.end();
  });

  it("reconciles cumulative partial and full refunds without double revocation", async () => {
    await repository.processEvent(checkoutEvent());

    const partial = await repository.processEvent({
      eventId: "evt_refund_partial",
      eventType: "refund.created",
      refundId: "ref_partial",
      status: "succeeded",
      providerOrderId: "provider_order_lifecycle",
      providerTransactionId: "tran_lifecycle",
      amountMinor: 400,
      currency: "USD",
      occurredAt: new Date("2026-07-31T04:00:00.000Z"),
      payload: { id: "evt_refund_partial" },
    });
    expect(partial).toMatchObject({ processed: true, duplicate: false, financialReviewRequired: false });

    expect((await sql`
      select status, refunded_amount_minor, financial_review_required
      from orders where id = 'ord_payment_lifecycle'
    `)[0]).toMatchObject({
      status: "partially_refunded",
      refunded_amount_minor: 400,
      financial_review_required: false,
    });
    expect((await sql`
      select quantity_available, quantity_revoked from entitlement_batches
      where order_id = 'ord_payment_lifecycle'
    `)[0]).toMatchObject({ quantity_available: 2, quantity_revoked: 3 });

    await repository.processEvent({
      eventId: "evt_refund_remaining",
      eventType: "refund.created",
      refundId: "ref_remaining",
      status: "succeeded",
      providerOrderId: "provider_order_lifecycle",
      providerTransactionId: "tran_lifecycle",
      amountMinor: 599,
      currency: "USD",
      occurredAt: new Date("2026-07-31T05:00:00.000Z"),
      payload: { id: "evt_refund_remaining" },
    });
    const duplicate = await repository.processEvent({
      eventId: "evt_refund_remaining",
      eventType: "refund.created",
      refundId: "ref_remaining",
      status: "succeeded",
      providerOrderId: "provider_order_lifecycle",
      providerTransactionId: "tran_lifecycle",
      amountMinor: 599,
      currency: "USD",
      occurredAt: new Date("2026-07-31T05:00:00.000Z"),
      payload: { id: "evt_refund_remaining" },
    });
    expect(duplicate).toEqual({ processed: false, duplicate: true });

    expect((await sql`
      select status, refunded_amount_minor from orders where id = 'ord_payment_lifecycle'
    `)[0]).toMatchObject({ status: "refunded", refunded_amount_minor: 999 });
    expect((await sql`
      select quantity_available, quantity_revoked from entitlement_batches
      where order_id = 'ord_payment_lifecycle'
    `)[0]).toMatchObject({ quantity_available: 0, quantity_revoked: 5 });
    expect(await sql`
      select id from entitlement_ledger
      where order_id = 'ord_payment_lifecycle' and action = 'revoke'
    `).toHaveLength(2);
  });

  it("marks a dispute for financial review when consumed credits cannot be revoked", async () => {
    await repository.processEvent(checkoutEvent());
    await sql`
      update entitlement_batches set quantity_available = 4, quantity_consumed = 1
      where order_id = 'ord_payment_lifecycle'
    `;

    const outcome = await repository.processEvent({
      eventId: "evt_dispute",
      eventType: "dispute.created",
      disputeId: "disp_lifecycle",
      providerOrderId: "provider_order_lifecycle",
      providerTransactionId: "tran_lifecycle",
      amountMinor: 999,
      currency: "USD",
      occurredAt: new Date("2026-07-31T06:00:00.000Z"),
      payload: { id: "evt_dispute" },
    });

    expect(outcome.financialReviewRequired).toBe(true);
    expect((await sql`
      select status, financial_review_required from orders where id = 'ord_payment_lifecycle'
    `)[0]).toMatchObject({ status: "disputed", financial_review_required: true });
    expect((await sql`
      select quantity_available, quantity_consumed, quantity_revoked
      from entitlement_batches where order_id = 'ord_payment_lifecycle'
    `)[0]).toMatchObject({ quantity_available: 0, quantity_consumed: 1, quantity_revoked: 4 });
  });

  it("rolls back an out-of-order refund so provider retry can succeed after checkout reconciliation", async () => {
    const refund = {
      eventId: "evt_refund_early",
      eventType: "refund.created" as const,
      refundId: "ref_early",
      status: "succeeded",
      providerOrderId: "provider_order_lifecycle",
      providerTransactionId: "tran_lifecycle",
      amountMinor: 999,
      currency: "USD",
      occurredAt: new Date("2026-07-31T02:59:00.000Z"),
      payload: { id: "evt_refund_early" },
    };

    await expect(repository.processEvent(refund)).rejects.toThrow("CREEM_ORDER_NOT_READY");
    expect(await sql`
      select event_id from webhook_inbox where event_id = 'evt_refund_early'
    `).toHaveLength(0);

    await repository.processEvent(checkoutEvent());
    await expect(repository.processEvent(refund)).resolves.toMatchObject({
      processed: true,
      duplicate: false,
    });
    expect((await sql`
      select status from orders where id = 'ord_payment_lifecycle'
    `)[0].status).toBe("refunded");
  });

  it("prevents financial ledger history from being updated or deleted", async () => {
    await repository.processEvent(checkoutEvent());
    const ledger = (await sql`
      select id from entitlement_ledger where order_id = 'ord_payment_lifecycle'
    `)[0];

    await expect(sql`
      update entitlement_ledger set quantity = 2 where id = ${ledger.id}
    `).rejects.toThrow("ENTITLEMENT_LEDGER_IMMUTABLE");
    await expect(sql`
      delete from entitlement_ledger where id = ${ledger.id}
    `).rejects.toThrow("ENTITLEMENT_LEDGER_IMMUTABLE");
  });
});
