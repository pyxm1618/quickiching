import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { PostgresPaymentRepository } from "./postgres-repository";
import type { NormalizedWaffoWebhook } from "./waffo-webhook";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");

const sql = postgres(databaseURL, { max: 12, prepare: false });
const db = drizzle(sql);
const repository = new PostgresPaymentRepository(sql);

function paymentEvent(input: {
  orderId: string;
  type?: string;
  deliveryId?: string;
  eventId?: string;
  amountMinor?: number;
  productKey?: "one" | "three" | "five" | null;
  providerProductId?: string | null;
  currency?: string;
  taxAmount?: string;
  total?: string;
  providerEnvironment?: "test" | "prod";
}): NormalizedWaffoWebhook {
  const type = input.type ?? "order.completed";
  const suffix = randomUUID();
  return {
    provider: "waffo",
    providerEnvironment: input.providerEnvironment ?? "test",
    deliveryId: input.deliveryId ?? `delivery-${suffix}`,
    eventId: input.eventId ?? `${type === "order.completed" ? "PAY" : "REF"}_${suffix}`,
    eventType: type,
    storeId: "STO_test",
    orderMerchantExternalId: input.orderId,
    providerOrderId: `ORD_${input.orderId}`,
    providerPaymentId: `PAY_${input.orderId}`,
    productKey: input.productKey === undefined ? "three" : input.productKey,
    providerProductId: input.providerProductId === undefined ? "PROD_test_three" : input.providerProductId,
    currency: input.currency ?? "USD",
    amountMinor: input.amountMinor ?? 699,
    taxAmount: input.taxAmount ?? "0.00",
    total: input.total ?? "6.99",
    payloadSha256: `hash-${suffix}`,
    supported: true,
    manualReviewReason: null,
  };
}

async function createUserAndOrder(suffix = randomUUID()) {
  const userId = `cp4-repo-user-${suffix}`;
  await sql`
    insert into users (id, name, email, email_verified, created_at, updated_at)
    values (${userId}, 'CP4 Repo User', ${`${suffix}@repo.example.com`}, true, now(), now())
  `;
  const result = await repository.createOrGetOrder({
    userId,
    productKey: "three",
    quantity: 3,
    amountMinor: 699,
    currency: "USD",
    requestId: `request-${suffix}`,
    providerEnvironment: "test",
    providerProductId: "PROD_test_three",
  });
  return { userId, order: result.order };
}

describe("CP4 PostgreSQL payment and entitlement core", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("installs the forward-only CP4 payment boundaries on an empty database", async () => {
    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'payment_orders', 'payment_webhook_inbox', 'payment_outbox',
          'entitlement_batches', 'entitlement_ledger', 'payment_financial_reviews'
        )
      order by table_name
    `;
    expect(tables.map((row) => row.table_name)).toEqual([
      "entitlement_batches",
      "entitlement_ledger",
      "payment_financial_reviews",
      "payment_orders",
      "payment_outbox",
      "payment_webhook_inbox",
    ]);

    const migrations = await sql<{ count: string }[]>`
      select count(*)::text as count from drizzle.__drizzle_migrations
    `;
    expect(migrations[0]?.count).toBe("6");
  });

  it("enforces order, Inbox/Outbox, ledger, and batch invariants in PostgreSQL", async () => {
    const suffix = randomUUID();
    const userId = `cp4-user-${suffix}`;
    const orderId = randomUUID();
    const inboxId = randomUUID();
    const batchId = randomUUID();
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (${userId}, 'CP4 User', ${`${suffix}@example.com`}, true, now(), now())
    `;
    await sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, status
      ) values (
        ${orderId}, ${userId}, 'three', 3, 699, 'USD', ${`request-${suffix}`},
        'waffo', 'test', 'PROD_test_three', 'pending'
      )
    `;
    await expect(sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, status
      ) values (
        ${randomUUID()}, ${userId}, 'three', 3, 700, 'USD', ${`bad-price-${suffix}`},
        'waffo', 'test', 'PROD_test_three', 'pending'
      )
    `).rejects.toThrow();

    await sql`
      insert into payment_webhook_inbox (
        id, provider, provider_environment, delivery_id, event_id, event_type,
        store_id, order_merchant_external_id, payload_sha256, normalized_payload,
        signature_verified_at, status
      ) values (
        ${inboxId}, 'waffo', 'test', ${`delivery-${suffix}`}, ${`PAY_${suffix}`},
        'order.completed', 'STO_test', ${orderId}, 'hash-one', ${JSON.stringify({ orderId })}::jsonb,
        now(), 'received'
      )
    `;
    await expect(sql`
      insert into payment_webhook_inbox (
        id, provider, provider_environment, delivery_id, event_id, event_type,
        store_id, order_merchant_external_id, payload_sha256, normalized_payload,
        signature_verified_at, status
      ) values (
        ${randomUUID()}, 'waffo', 'test', ${`delivery-${suffix}-other`}, ${`PAY_${suffix}`},
        'order.completed', 'STO_test', ${orderId}, 'hash-two', ${JSON.stringify({ orderId })}::jsonb,
        now(), 'received'
      )
    `).rejects.toThrow();

    await sql`
      insert into entitlement_batches (
        id, user_id, order_id, quantity_total, quantity_available,
        quantity_reserved, quantity_consumed, quantity_revoked, expires_at
      ) values (${batchId}, ${userId}, ${orderId}, 3, 3, 0, 0, 0, now() + interval '12 months')
    `;
    await expect(sql`
      update entitlement_batches set quantity_available = 2 where id = ${batchId}
    `).rejects.toThrow();
    await sql`
      insert into entitlement_ledger (
        id, batch_id, order_id, webhook_inbox_id, action, quantity, business_key
      ) values (
        ${randomUUID()}, ${batchId}, ${orderId}, ${inboxId}, 'grant', 3, ${`grant:${orderId}`}
      )
    `;
    await expect(sql`
      insert into entitlement_ledger (
        id, batch_id, order_id, webhook_inbox_id, action, quantity, business_key
      ) values (
        ${randomUUID()}, ${batchId}, ${orderId}, ${inboxId}, 'grant', 3, ${`grant:${orderId}`}
      )
    `).rejects.toThrow();
  });

  it("creates one server-authoritative order under concurrent idempotent requests and rejects reuse conflicts", async () => {
    const suffix = randomUUID();
    const userId = `cp4-concurrent-user-${suffix}`;
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (${userId}, 'Concurrent User', ${`${suffix}@concurrent.example.com`}, true, now(), now())
    `;
    const input = {
      userId,
      productKey: "three" as const,
      quantity: 3,
      amountMinor: 699,
      currency: "USD" as const,
      requestId: `request-${suffix}`,
      providerEnvironment: "test" as const,
      providerProductId: "PROD_test_three",
    };

    const results = await Promise.all(Array.from({ length: 12 }, () => repository.createOrGetOrder(input)));
    expect(new Set(results.map((result) => result.order.id)).size).toBe(1);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    await expect(repository.createOrGetOrder({
      ...input,
      productKey: "five",
      quantity: 5,
      amountMinor: 999,
      providerProductId: "PROD_test_five",
    })).rejects.toThrow("PAYMENT_IDEMPOTENCY_CONFLICT");
  });

  it("grants one checkout initialization claim and freezes an ambiguous provider outcome", async () => {
    const { order } = await createUserAndOrder();
    const claims = await Promise.all(Array.from({ length: 10 }, (_, index) =>
      repository.claimCheckoutInitialization({
        orderId: order.id,
        claimToken: `claim-${index}-${randomUUID()}`,
        leaseDurationMs: 120_000,
      })));
    expect(claims.filter(Boolean)).toHaveLength(1);
    const row = await sql<{ checkout_claim_token: string }[]>`
      select checkout_claim_token from payment_orders where id = ${order.id}
    `;
    const winningToken = row[0]?.checkout_claim_token;
    expect(winningToken).toBeTruthy();

    await expect(repository.saveCheckout({
      orderId: order.id,
      claimToken: "wrong-claim",
      providerCheckoutSessionId: "cs_wrong",
      providerCheckoutUrl: "https://pancake.waffo.ai/checkout/cs_wrong",
      checkoutExpiresAt: new Date(Date.now() + 60_000),
    })).rejects.toThrow("PAYMENT_CHECKOUT_CLAIM_INVALID");
    await repository.failCheckoutInitialization({
      orderId: order.id,
      claimToken: winningToken!,
      errorCode: "CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN",
    });
    const frozen = await sql<{ status: string; checkout_error_code: string }[]>`
      select status, checkout_error_code from payment_orders where id = ${order.id}
    `;
    expect(frozen).toEqual([{
      status: "financial_review",
      checkout_error_code: "CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN",
    }]);
  });

  it("persists checkout only for the matching database claim", async () => {
    const { order } = await createUserAndOrder();
    const claimToken = `claim-${randomUUID()}`;
    await expect(repository.claimCheckoutInitialization({
      orderId: order.id,
      claimToken,
      leaseDurationMs: 120_000,
    })).resolves.toBe(true);
    const saved = await repository.saveCheckout({
      orderId: order.id,
      claimToken,
      providerCheckoutSessionId: `cs_${randomUUID()}`,
      providerCheckoutUrl: "https://pancake.waffo.ai/checkout/session#token=redirect",
      checkoutExpiresAt: new Date(Date.now() + 60_000),
    });
    expect(saved).toMatchObject({ status: "checkout_created" });
  });

  it("deduplicates delivery and business event identities before exactly-once concurrent grant", async () => {
    const { order } = await createUserAndOrder();
    const original = paymentEvent({ orderId: order.id });
    const recorded = await repository.recordVerifiedEvent(original);
    expect(recorded).toMatchObject({ duplicate: null });

    const duplicateDelivery = await repository.recordVerifiedEvent(original);
    expect(duplicateDelivery).toMatchObject({ duplicate: "delivery", inboxId: recorded.inboxId });
    const duplicateEvent = await repository.recordVerifiedEvent({
      ...original,
      deliveryId: `other-${randomUUID()}`,
      payloadSha256: `other-hash-${randomUUID()}`,
    });
    expect(duplicateEvent).toMatchObject({ duplicate: "event", inboxId: recorded.inboxId });

    const outcomes = await Promise.all(Array.from({ length: 10 }, () => repository.processInbox(recorded.inboxId)));
    expect(outcomes.every((outcome) => outcome.outcome === "granted" || outcome.outcome === "already_processed"))
      .toBe(true);
    const ledger = await sql<{ count: string }[]>`
      select count(*)::text as count from entitlement_ledger
      where order_id = ${order.id} and action = 'grant'
    `;
    const batch = await sql<{ available: number; total: number }[]>`
      select quantity_available as available, quantity_total as total
      from entitlement_batches where order_id = ${order.id}
    `;
    expect(ledger[0]?.count).toBe("1");
    expect(batch).toEqual([{ available: 3, total: 3 }]);
  });

  it.each([
    ["PAYMENT_AMOUNT_MISMATCH", { amountMinor: 698 }],
    ["PAYMENT_PRODUCT_MISMATCH", { productKey: "five" as const }],
    ["PAYMENT_PROVIDER_PRODUCT_MISMATCH", { providerProductId: "PROD_wrong" }],
    ["PAYMENT_CURRENCY_MISMATCH", { currency: "EUR" }],
    ["PAYMENT_ENVIRONMENT_MISMATCH", { providerEnvironment: "prod" as const }],
    ["PAYMENT_TAX_SEMANTICS_UNRESOLVED", { taxAmount: "1.00", total: "7.99" }],
    ["PAYMENT_TOTAL_MISMATCH", { total: "6.98" }],
  ])("routes %s to financial review without granting", async (reason, override) => {
    const { order } = await createUserAndOrder();
    const recorded = await repository.recordVerifiedEvent(paymentEvent({ orderId: order.id, ...override }));
    await expect(repository.processInbox(recorded.inboxId)).resolves.toMatchObject({
      outcome: "financial_review",
      reason,
    });
    const rows = await sql<{ batches: string; reviews: string }[]>`
      select
        (select count(*) from entitlement_batches where order_id = ${order.id})::text as batches,
        (select count(*) from payment_financial_reviews where order_id = ${order.id})::text as reviews
    `;
    expect(rows).toEqual([{ batches: "0", reviews: "1" }]);
  });

  it("revokes a fully available grant exactly once on a full refund", async () => {
    const { order } = await createUserAndOrder();
    const paid = await repository.recordVerifiedEvent(paymentEvent({ orderId: order.id }));
    await repository.processInbox(paid.inboxId);
    const refund = await repository.recordVerifiedEvent(paymentEvent({
      orderId: order.id,
      type: "refund.succeeded",
    }));

    const results = await Promise.all(Array.from({ length: 8 }, () => repository.processInbox(refund.inboxId)));
    expect(results.some((result) => result.outcome === "revoked")).toBe(true);
    const state = await sql<{ status: string; available: number; revoked: number; revokes: string }[]>`
      select o.status, b.quantity_available as available, b.quantity_revoked as revoked,
        (select count(*) from entitlement_ledger l where l.order_id = o.id and l.action = 'revoke')::text as revokes
      from payment_orders o join entitlement_batches b on b.order_id = o.id
      where o.id = ${order.id}
    `;
    expect(state).toEqual([{ status: "refunded", available: 0, revoked: 3, revokes: "1" }]);
  });

  it("fails closed to financial review for partial or already-consumed refund semantics", async () => {
    const partial = await createUserAndOrder();
    const partialPaid = await repository.recordVerifiedEvent(paymentEvent({ orderId: partial.order.id }));
    await repository.processInbox(partialPaid.inboxId);
    const partialRefund = await repository.recordVerifiedEvent(paymentEvent({
      orderId: partial.order.id,
      type: "refund.succeeded",
      amountMinor: 300,
    }));
    await expect(repository.processInbox(partialRefund.inboxId)).resolves.toMatchObject({
      outcome: "financial_review",
      reason: "REFUND_PARTIAL_UNSUPPORTED",
    });

    const consumed = await createUserAndOrder();
    const consumedPaid = await repository.recordVerifiedEvent(paymentEvent({ orderId: consumed.order.id }));
    await repository.processInbox(consumedPaid.inboxId);
    await sql`
      update entitlement_batches
      set quantity_available = quantity_available - 1, quantity_consumed = quantity_consumed + 1
      where order_id = ${consumed.order.id}
    `;
    const consumedRefund = await repository.recordVerifiedEvent(paymentEvent({
      orderId: consumed.order.id,
      type: "refund.succeeded",
    }));
    await expect(repository.processInbox(consumedRefund.inboxId)).resolves.toMatchObject({
      outcome: "financial_review",
      reason: "REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE",
    });
  });

  it("retains an unresolved chargeback for manual review without mutating entitlements", async () => {
    const { order } = await createUserAndOrder();
    const event = paymentEvent({ orderId: order.id, type: "chargeback.opened" });
    event.manualReviewReason = "CHARGEBACK_POLICY_UNRESOLVED";
    const recorded = await repository.recordVerifiedEvent(event);
    await expect(repository.processInbox(recorded.inboxId)).resolves.toMatchObject({
      outcome: "financial_review",
      reason: "CHARGEBACK_POLICY_UNRESOLVED",
    });
    const batches = await sql<{ count: string }[]>`
      select count(*)::text as count from entitlement_batches where order_id = ${order.id}
    `;
    expect(batches[0]?.count).toBe("0");
  });

  it("retains an out-of-order refund and applies it after the matching payment arrives", async () => {
    const { order } = await createUserAndOrder();
    const refund = await repository.recordVerifiedEvent(paymentEvent({
      orderId: order.id,
      type: "refund.succeeded",
    }));
    await expect(repository.processInbox(refund.inboxId)).resolves.toMatchObject({ outcome: "pending_order" });

    const paid = await repository.recordVerifiedEvent(paymentEvent({ orderId: order.id }));
    await expect(repository.processInbox(paid.inboxId)).resolves.toMatchObject({ outcome: "granted" });
    const state = await sql<{ status: string; available: number; revoked: number }[]>`
      select o.status, b.quantity_available as available, b.quantity_revoked as revoked
      from payment_orders o join entitlement_batches b on b.order_id = o.id
      where o.id = ${order.id}
    `;
    expect(state).toEqual([{ status: "refunded", available: 0, revoked: 3 }]);
  });

  it("settles concurrently processed payment and out-of-order refund without a lock cycle", async () => {
    const { order } = await createUserAndOrder();
    const refund = await repository.recordVerifiedEvent(paymentEvent({
      orderId: order.id,
      type: "refund.succeeded",
    }));
    const paid = await repository.recordVerifiedEvent(paymentEvent({ orderId: order.id }));

    await expect(Promise.all([
      repository.processInbox(refund.inboxId),
      repository.processInbox(paid.inboxId),
    ])).resolves.toBeDefined();
    await repository.processInbox(refund.inboxId);
    const state = await sql<{ status: string; grants: string; revokes: string }[]>`
      select o.status,
        (select count(*) from entitlement_ledger l where l.order_id = o.id and l.action = 'grant')::text as grants,
        (select count(*) from entitlement_ledger l where l.order_id = o.id and l.action = 'revoke')::text as revokes
      from payment_orders o where o.id = ${order.id}
    `;
    expect(state).toEqual([{ status: "refunded", grants: "1", revokes: "1" }]);
  });

  it("moves a repeatedly failing verified event to a retained dead-letter state", async () => {
    const { order } = await createUserAndOrder();
    const recorded = await repository.recordVerifiedEvent(paymentEvent({ orderId: order.id }));
    await repository.recordProcessingFailure(recorded.inboxId, "DATABASE_TRANSIENT");
    await repository.recordProcessingFailure(recorded.inboxId, "DATABASE_TRANSIENT");
    const final = await repository.recordProcessingFailure(recorded.inboxId, "DATABASE_TRANSIENT");
    expect(final).toEqual({ deadLetter: true, attemptCount: 3 });
    const rows = await sql<{ inbox_status: string; outbox_status: string }[]>`
      select i.status as inbox_status, o.status as outbox_status
      from payment_webhook_inbox i join payment_outbox o on o.inbox_id = i.id
      where i.id = ${recorded.inboxId}
    `;
    expect(rows).toEqual([{ inbox_status: "dead_letter", outbox_status: "dead_letter" }]);

    await expect(repository.replayDeadLetter(recorded.inboxId, "OPERATOR_REVIEWED"))
      .resolves.toBe(true);
    await expect(repository.processInbox(recorded.inboxId)).resolves.toMatchObject({ outcome: "granted" });
    const replayed = await sql<{ attempts: number; grants: string; replay_code: string }[]>`
      select i.attempt_count as attempts, i.last_error_code as replay_code,
        (select count(*) from entitlement_ledger l where l.webhook_inbox_id = i.id and l.action = 'grant')::text as grants
      from payment_webhook_inbox i where i.id = ${recorded.inboxId}
    `;
    expect(replayed).toEqual([{ attempts: 3, grants: "1", replay_code: "REPLAY_OPERATOR_REVIEWED" }]);
  });
});
