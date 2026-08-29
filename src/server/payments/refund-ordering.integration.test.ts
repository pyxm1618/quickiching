import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { databaseSchema } from "@/server/db/schema";
import { PostgresPaymentRepository } from "./postgres-repository";
import { createOutboxDispatcher } from "./outbox-dispatcher";
import { canonicalWaffoPayloadHash, type NormalizedWaffoWebhook } from "./waffo-webhook";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");

const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql, { schema: databaseSchema });

function makeEvent(
  orderId: string,
  userId: string,
  eventType: "order.completed" | "refund.succeeded",
  providerOrderId: string,
  providerPaymentId: string,
): NormalizedWaffoWebhook {
  const base: Omit<NormalizedWaffoWebhook, "canonicalPayloadSha256"> = {
    provider: "waffo",
    providerEnvironment: "test",
    deliveryId: `del-${randomUUID()}`,
    eventId: `evt-${randomUUID()}`,
    eventType,
    storeId: "store-1",
    orderMerchantExternalId: orderId,
    merchantProvidedBuyerIdentity: userId,
    internalOrderId: orderId,
    refundTicketMerchantExternalId: eventType === "refund.succeeded" ? `refund-${orderId}` : null,
    productKey: "one",
    amountMinor: 299,
    currency: "USD",
    providerOrderId,
    providerPaymentId,
    providerProductId: "prod-1",
    taxAmount: "0.00",
    total: eventType === "order.completed" ? "2.99" : null,
    payloadSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    supported: true,
    manualReviewReason: null,
  };
  return {
    ...base,
    canonicalPayloadSha256: canonicalWaffoPayloadHash(base as NormalizedWaffoWebhook),
  };
}

async function insertUserAndPendingOrder(userId: string, orderId: string): Promise<void> {
  await sql`
    insert into users (id, name, email, email_verified, created_at, updated_at)
    values (${userId}, 'Refund Ordering User', ${`${userId}@example.com`}, true, clock_timestamp(), clock_timestamp())
  `;
  await sql`
    insert into payment_orders (
      id, user_id, product_key, quantity, amount_minor, currency, request_id,
      provider, provider_environment, provider_product_id, status, created_at, updated_at
    ) values (
      ${orderId}, ${userId}, 'one', 1, 299, 'USD', ${`req-${orderId}`},
      'waffo', 'test', 'prod-1', 'pending', clock_timestamp(), clock_timestamp()
    )
  `;
}

describe("CP6 refund-before-order repair", () => {
  const repository = new PostgresPaymentRepository(sql, {
    checkoutUrlKeys: "v1:test-secret-key-material-32-chars-long!",
  });
  const dispatcher = createOutboxDispatcher({ sql, repository });

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("defers a refund whose order does not exist without consuming retry budget", async () => {
    const orderId = randomUUID();
    const userId = `refund-wait-${randomUUID()}`;
    const refund = makeEvent(orderId, userId, "refund.succeeded", `po-${orderId}`, `pp-${orderId}`);
    const recorded = await repository.recordVerifiedEvent(refund);

    const claimed = await dispatcher.claimBatch({ limit: 10 });
    const refundItem = claimed.find((candidate) => candidate.inboxId === recorded.inboxId);
    expect(refundItem).toBeDefined();
    const result = await dispatcher.dispatchItem(refundItem!);
    expect(result.outcome).toBe("pending_order");

    const rows = await sql<{
      inbox_status: string;
      outbox_status: string;
      inbox_attempts: number;
      outbox_attempts: number;
      deferred: boolean;
    }[]>`
      select i.status as inbox_status, o.status as outbox_status,
             i.attempt_count as inbox_attempts, o.attempt_count as outbox_attempts,
             o.available_at > clock_timestamp() as deferred
      from payment_webhook_inbox i
      join payment_outbox o on o.inbox_id = i.id
      where i.id = ${recorded.inboxId}
    `;

    expect(rows).toEqual([{
      inbox_status: "pending_order",
      outbox_status: "pending",
      inbox_attempts: 0,
      outbox_attempts: 0,
      deferred: true,
    }]);

    const immediate = await dispatcher.dispatchAllPending({ batchSize: 20, maxBatches: 3 });
    expect(immediate.results.some((entry) => entry.inboxId === recorded.inboxId)).toBe(false);
  });

  it("links a previously unlinked refund when the order later appears and settles it in the payment transaction", async () => {
    const orderId = randomUUID();
    const userId = `refund-late-order-${randomUUID()}`;
    const providerOrderId = `po-${orderId}`;
    const providerPaymentId = `pp-${orderId}`;
    const refund = makeEvent(orderId, userId, "refund.succeeded", providerOrderId, providerPaymentId);
    const recordedRefund = await repository.recordVerifiedEvent(refund);

    const claimedRefund = await dispatcher.claimBatch({ limit: 10 });
    const refundItem = claimedRefund.find((candidate) => candidate.inboxId === recordedRefund.inboxId);
    expect(refundItem).toBeDefined();
    await dispatcher.dispatchItem(refundItem!);

    await insertUserAndPendingOrder(userId, orderId);
    const payment = makeEvent(orderId, userId, "order.completed", providerOrderId, providerPaymentId);
    const recordedPayment = await repository.recordVerifiedEvent(payment);
    const claimedPayment = await dispatcher.claimBatch({ limit: 10 });
    const paymentItem = claimedPayment.find((candidate) => candidate.inboxId === recordedPayment.inboxId);
    expect(paymentItem).toBeDefined();
    const paymentResult = await dispatcher.dispatchItem(paymentItem!);
    expect(paymentResult.outcome).toBe("granted");

    const orderRows = await sql<{ status: string }[]>`
      select status from payment_orders where id = ${orderId}
    `;
    expect(orderRows).toEqual([{ status: "refunded" }]);

    const batchRows = await sql<{ quantity_available: number; quantity_revoked: number }[]>`
      select quantity_available, quantity_revoked from entitlement_batches where order_id = ${orderId}
    `;
    expect(batchRows).toEqual([{ quantity_available: 0, quantity_revoked: 1 }]);

    const refundRows = await sql<{ linked_order_id: string; status: string }[]>`
      select linked_order_id, status from payment_webhook_inbox where id = ${recordedRefund.inboxId}
    `;
    expect(refundRows).toEqual([{ linked_order_id: orderId, status: "processed" }]);
  });

  it("fails closed when a legacy pre-order refund is already dead-lettered before payment arrives", async () => {
    const orderId = randomUUID();
    const userId = `refund-dead-${randomUUID()}`;
    const providerOrderId = `po-${orderId}`;
    const providerPaymentId = `pp-${orderId}`;
    const refund = makeEvent(orderId, userId, "refund.succeeded", providerOrderId, providerPaymentId);
    const recordedRefund = await repository.recordVerifiedEvent(refund);

    await sql`
      update payment_webhook_inbox
      set status = 'dead_letter', attempt_count = 3, last_error_code = 'MAX_ATTEMPTS_EXCEEDED'
      where id = ${recordedRefund.inboxId}
    `;
    await sql`
      update payment_outbox
      set status = 'dead_letter', attempt_count = 3, last_error_code = 'MAX_ATTEMPTS_EXCEEDED'
      where inbox_id = ${recordedRefund.inboxId}
    `;

    await insertUserAndPendingOrder(userId, orderId);
    const payment = makeEvent(orderId, userId, "order.completed", providerOrderId, providerPaymentId);
    const recordedPayment = await repository.recordVerifiedEvent(payment);
    const claimed = await dispatcher.claimBatch({ limit: 10 });
    const paymentItem = claimed.find((candidate) => candidate.inboxId === recordedPayment.inboxId);
    expect(paymentItem).toBeDefined();
    const outcome = await dispatcher.dispatchItem(paymentItem!);

    expect(outcome.outcome).toBe("financial_review");
    const orderRows = await sql<{ status: string }[]>`
      select status from payment_orders where id = ${orderId}
    `;
    expect(orderRows).toEqual([{ status: "financial_review" }]);
    const batches = await sql<{ count: number }[]>`
      select count(*)::integer as count from entitlement_batches where order_id = ${orderId}
    `;
    expect(batches[0]?.count).toBe(0);
  });
});
