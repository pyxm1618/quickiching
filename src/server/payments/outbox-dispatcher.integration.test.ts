import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { databaseSchema } from "@/server/db/schema";
import { PostgresPaymentRepository } from "./postgres-repository";
import { createOutboxDispatcher, OutboxDispatcher } from "./outbox-dispatcher";
import { canonicalWaffoPayloadHash, type NormalizedWaffoWebhook } from "./waffo-webhook";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");

const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql, { schema: databaseSchema });

function makeEvent(orderId: string, userId: string, type: "order.completed" | "refund.succeeded" = "order.completed"): NormalizedWaffoWebhook {
  const deliveryId = `del-${randomUUID()}`;
  const eventId = `evt-${randomUUID()}`;
  const base: Omit<NormalizedWaffoWebhook, "canonicalPayloadSha256"> = {
    provider: "waffo",
    providerEnvironment: "test",
    deliveryId,
    eventId,
    eventType: type,
    storeId: "store-1",
    orderMerchantExternalId: orderId,
    merchantProvidedBuyerIdentity: userId,
    internalOrderId: orderId,
    refundTicketMerchantExternalId: type === "refund.succeeded" ? `ref-${orderId}` : null,
    productKey: "one",
    amountMinor: 299,
    currency: "USD",
    providerOrderId: `p-ord-${orderId}`,
    providerPaymentId: `p-pay-${orderId}`,
    providerProductId: "prod-1",
    taxAmount: "0.00",
    total: type === "order.completed" ? "2.99" : null,
    payloadSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    supported: true,
    manualReviewReason: null,
  };
  return {
    ...base,
    canonicalPayloadSha256: canonicalWaffoPayloadHash(base as NormalizedWaffoWebhook),
  };
}

describe("CP5A Durable Payment Outbox Dispatcher (PostgreSQL)", () => {
  let repository: PostgresPaymentRepository;
  let dispatcher: OutboxDispatcher;
  const testUserId = "cp5-disp-user-1";
  const testUserTwoId = "cp5-disp-user-2";

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
    repository = new PostgresPaymentRepository(sql, {
      checkoutUrlKeys: "v1:test-secret-key-material-32-chars-long!",
    });
    dispatcher = createOutboxDispatcher({ sql, repository });

    const now = new Date().toISOString();
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values
        (${testUserId}, 'Dispatcher User 1', 'disp1@example.com', true, ${now}, ${now}),
        (${testUserTwoId}, 'Dispatcher User 2', 'disp2@example.com', true, ${now}, ${now})
      on conflict (id) do nothing
    `;
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("claims pending outbox items mutually exclusively between two concurrent workers (NEG-01)", async () => {
    const orderId1 = randomUUID();
    const orderId2 = randomUUID();
    const now = new Date().toISOString();

    await sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, status, created_at, updated_at
      ) values
        (${orderId1}, ${testUserId}, 'one', 1, 299, 'USD', ${`req-${orderId1}`}, 'waffo', 'test', 'prod-1', 'pending', ${now}, ${now}),
        (${orderId2}, ${testUserId}, 'one', 1, 299, 'USD', ${`req-${orderId2}`}, 'waffo', 'test', 'prod-1', 'pending', ${now}, ${now})
    `;

    const evt1 = makeEvent(orderId1, testUserId);
    const evt2 = makeEvent(orderId2, testUserId);

    await repository.recordVerifiedEvent(evt1);
    await repository.recordVerifiedEvent(evt2);

    // Worker 1 and Worker 2 claim concurrently with limit 1
    const [claimedWorker1, claimedWorker2] = await Promise.all([
      dispatcher.claimBatch({ limit: 1 }),
      dispatcher.claimBatch({ limit: 1 }),
    ]);

    expect(claimedWorker1.length).toBe(1);
    expect(claimedWorker2.length).toBe(1);
    expect(claimedWorker1[0]?.id).not.toBe(claimedWorker2[0]?.id);

    // Clean up
    if (claimedWorker1[0]) await dispatcher.dispatchItem(claimedWorker1[0]);
    if (claimedWorker2[0]) await dispatcher.dispatchItem(claimedWorker2[0]);
  });

  it("recovers an expired lease when worker crashes (NEG-02)", async () => {
    const orderId = randomUUID();
    const now = new Date().toISOString();

    await sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, status, created_at, updated_at
      ) values (${orderId}, ${testUserId}, 'one', 1, 299, 'USD', ${`req-${orderId}`}, 'waffo', 'test', 'prod-1', 'pending', ${now}, ${now})
    `;

    const event = makeEvent(orderId, testUserId);
    const recorded = await repository.recordVerifiedEvent(event);

    // Simulate crashed worker by updating outbox lease to expired
    await sql`
      update payment_outbox
      set status = 'processing', lease_token = 'crashed-token',
          lease_expires_at = clock_timestamp() - interval '10 seconds'
      where inbox_id = ${recorded.inboxId}
    `;

    // Reconcile / Dispatcher recovers expired lease and processes successfully
    const recovered = await dispatcher.claimBatch({ limit: 10 });
    const recoveredItem = recovered.find((item) => item.inboxId === recorded.inboxId);
    expect(recoveredItem).toBeDefined();

    if (recoveredItem) {
      const result = await dispatcher.dispatchItem(recoveredItem);
      expect(result.outcome).toBe("granted");
    }

    // Verify order is now paid and entitlement granted exactly once
    const orderRows = await sql<{ status: string }[]>`select status from payment_orders where id = ${orderId}`;
    expect(orderRows[0]?.status).toBe("paid");

    const batchRows = await sql<{ quantity_available: number }[]>`select quantity_available from entitlement_batches where order_id = ${orderId}`;
    expect(batchRows[0]?.quantity_available).toBe(1);
  });

  it("handles refund before payment (out-of-order webhook) and settles properly (NEG-04)", async () => {
    const orderId = randomUUID();
    const now = new Date().toISOString();

    await sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, status, created_at, updated_at
      ) values (${orderId}, ${testUserId}, 'one', 1, 299, 'USD', ${`req-${orderId}`}, 'waffo', 'test', 'prod-1', 'pending', ${now}, ${now})
    `;

    const refundEvent = makeEvent(orderId, testUserId, "refund.succeeded");
    const recordedRefund = await repository.recordVerifiedEvent(refundEvent);

    // Dispatcher processes refund first -> pending_order
    let claimed = await dispatcher.claimBatch({ limit: 10 });
    let refundItem = claimed.find((c) => c.inboxId === recordedRefund.inboxId);
    if (refundItem) {
      const outcome = await dispatcher.dispatchItem(refundItem);
      expect(outcome.outcome).toBe("pending_order");
    }

    // 2. Payment arrives second
    const paymentEvent = {
      ...refundEvent,
      deliveryId: `del-${randomUUID()}`,
      eventId: `evt-${randomUUID()}`,
      eventType: "order.completed",
      refundTicketMerchantExternalId: null,
      total: "2.99",
    };
    paymentEvent.canonicalPayloadSha256 = canonicalWaffoPayloadHash(paymentEvent as NormalizedWaffoWebhook);

    const recordedPay = await repository.recordVerifiedEvent(paymentEvent as NormalizedWaffoWebhook);

    // Dispatch payment -> automatically settles pending refund in single lock order
    claimed = await dispatcher.claimBatch({ limit: 10 });
    const paymentItem = claimed.find((c) => c.inboxId === recordedPay.inboxId);
    expect(paymentItem).toBeDefined();

    if (paymentItem) {
      const outcome = await dispatcher.dispatchItem(paymentItem);
      expect(outcome.outcome).toBe("granted");
    }

    // Final state of order must be refunded and batch revoked
    const orderRows = await sql<{ status: string }[]>`select status from payment_orders where id = ${orderId}`;
    expect(orderRows[0]?.status).toBe("refunded");

    const batchRows = await sql<{ quantity_available: number; quantity_revoked: number }[]>`
      select quantity_available, quantity_revoked from entitlement_batches where order_id = ${orderId}
    `;
    expect(batchRows[0]?.quantity_available).toBe(0);
    expect(batchRows[0]?.quantity_revoked).toBe(1);
  });

  it("moves to financial_review when refund requested on consumed credits (NEG-05)", async () => {
    const orderId = randomUUID();
    const castingId = randomUUID();
    const jobId = randomUUID();
    const resId = randomUUID();
    const now = new Date().toISOString();

    await sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, status, created_at, updated_at
      ) values (${orderId}, ${testUserId}, 'one', 1, 299, 'USD', ${`req-${orderId}`}, 'waffo', 'test', 'prod-1', 'pending', ${now}, ${now})
    `;

    const paymentEvent = makeEvent(orderId, testUserId, "order.completed");
    const recordedPay = await repository.recordVerifiedEvent(paymentEvent);

    const claimedPay = await dispatcher.claimBatch({ limit: 10 });
    const payItem = claimedPay.find((c) => c.inboxId === recordedPay.inboxId);
    if (payItem) await dispatcher.dispatchItem(payItem);

    // Consume the credit for a deep reading
    const batchRows = await sql<{ id: string }[]>`select id from entitlement_batches where order_id = ${orderId}`;
    const batchId = batchRows[0]!.id;

    await sql`
      insert into casting_sessions (id, user_id, method, lifecycle, risk_status, scene, interpretation_goal, created_at, updated_at)
      values (${castingId}, ${testUserId}, 'three_coin', 'revealed', 'allowed', 'career', 'guidance', ${now}, ${now})
    `;
    await sql`
      insert into generation_jobs (id, casting_id, kind, status, generation_epoch, idempotency_key, input_snapshot_hash, timeout_at, created_at, updated_at)
      values (${jobId}, ${castingId}, 'deep_reading', 'completed', 0, ${`idem-${jobId}`}, 'hash-snap', now() + interval '1 hour', ${now}, ${now})
    `;
    await sql`
      insert into entitlement_reservations (id, batch_id, user_id, casting_id, job_id, status, expires_at, created_at, updated_at)
      values (${resId}, ${batchId}, ${testUserId}, ${castingId}, ${jobId}, 'consumed', now() + interval '12 months', ${now}, ${now})
    `;
    await sql`
      update entitlement_batches
      set quantity_available = 0, quantity_consumed = 1, updated_at = clock_timestamp()
      where id = ${batchId}
    `;

    // Now refund event arrives
    const refundEvent = {
      ...paymentEvent,
      deliveryId: `del-${randomUUID()}`,
      eventId: `evt-${randomUUID()}`,
      eventType: "refund.succeeded",
      refundTicketMerchantExternalId: `ref-${orderId}`,
      total: null,
    };
    refundEvent.canonicalPayloadSha256 = canonicalWaffoPayloadHash(refundEvent as NormalizedWaffoWebhook);

    const recordedRef = await repository.recordVerifiedEvent(refundEvent as NormalizedWaffoWebhook);

    const claimedRef = await dispatcher.claimBatch({ limit: 10 });
    const refItem = claimedRef.find((c) => c.inboxId === recordedRef.inboxId);
    expect(refItem).toBeDefined();

    if (refItem) {
      const outcome = await dispatcher.dispatchItem(refItem);
      expect(outcome.outcome).toBe("financial_review");
      expect(outcome.reason).toBe("REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE");
    }

    // Verify financial review was opened and order marked as financial_review
    const orderRows = await sql<{ status: string }[]>`select status from payment_orders where id = ${orderId}`;
    expect(orderRows[0]?.status).toBe("financial_review");

    const reviewRows = await sql<{ reason_code: string; status: string }[]>`
      select reason_code, status from payment_financial_reviews where order_id = ${orderId}
    `;
    expect(reviewRows[0]?.reason_code).toBe("REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE");
    expect(reviewRows[0]?.status).toBe("open");
  });

  it("handles dead-letter transitions and operator replay with audit logging (NEG-12)", async () => {
    const orderId = randomUUID();
    const now = new Date().toISOString();

    await sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, status, created_at, updated_at
      ) values (${orderId}, ${testUserId}, 'one', 1, 299, 'USD', ${`req-${orderId}`}, 'waffo', 'test', 'prod-1', 'pending', ${now}, ${now})
    `;

    const event = makeEvent(orderId, testUserId);
    const recorded = await repository.recordVerifiedEvent(event);

    // Set attempt count to 2
    await sql`
      update payment_webhook_inbox set status = 'failed', attempt_count = 2 where id = ${recorded.inboxId}
    `;
    await sql`
      update payment_outbox set status = 'failed', attempt_count = 2 where inbox_id = ${recorded.inboxId}
    `;

    // Third failure triggers dead-letter transition
    const failResult = await repository.recordProcessingFailure(recorded.inboxId, "NETWORK_TIMEOUT");
    expect(failResult.deadLetter).toBe(true);
    expect(failResult.attemptCount).toBe(3);

    const outboxRows = await sql<{ status: string }[]>`select status from payment_outbox where inbox_id = ${recorded.inboxId}`;
    expect(outboxRows[0]?.status).toBe("dead_letter");

    // Operator replay with reason code
    const replayed = await repository.replayDeadLetter(recorded.inboxId, "MANUAL_REPAIR_CONFIRMED");
    expect(replayed).toBe(true);

    const replayedOutbox = await sql<{ status: string; attempt_count: number }[]>`
      select status, attempt_count from payment_outbox where inbox_id = ${recorded.inboxId}
    `;
    expect(replayedOutbox[0]?.status).toBe("pending");
    expect(replayedOutbox[0]?.attempt_count).toBe(0);

    const replayedInbox = await sql<{ status: string; replay_count: number; last_replay_reason: string }[]>`
      select status, replay_count, last_replay_reason from payment_webhook_inbox where id = ${recorded.inboxId}
    `;
    expect(replayedInbox[0]?.status).toBe("received");
    expect(replayedInbox[0]?.replay_count).toBe(1);
    expect(replayedInbox[0]?.last_replay_reason).toBe("MANUAL_REPAIR_CONFIRMED");
  });
});
