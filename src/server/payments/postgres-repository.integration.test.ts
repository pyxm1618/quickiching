import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { PostgresPaymentRepository } from "./postgres-repository";
import { canonicalWaffoPayloadHash, type NormalizedWaffoWebhook } from "./waffo-webhook";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
process.env.APP_SECRET ??= "cp4-payment-integration-encryption-secret";

const sql = postgres(databaseURL, { max: 12, prepare: false });
const db = drizzle(sql);
const repository = new PostgresPaymentRepository(sql);
const orderUsers = new Map<string, string>();

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
  providerOrderId?: string;
  providerPaymentId?: string | null;
  merchantProvidedBuyerIdentity?: string | null;
  internalOrderId?: string | null;
  refundTicketMerchantExternalId?: string | null;
}): NormalizedWaffoWebhook {
  const type = input.type ?? "order.completed";
  const suffix = randomUUID();
  const event: NormalizedWaffoWebhook = {
    provider: "waffo",
    providerEnvironment: input.providerEnvironment ?? "test",
    deliveryId: input.deliveryId ?? `delivery-${suffix}`,
    eventId: input.eventId ?? `${type === "order.completed" ? "PAY" : "REF"}_${suffix}`,
    eventType: type,
    storeId: "STO_test",
    orderMerchantExternalId: input.orderId,
    merchantProvidedBuyerIdentity: input.merchantProvidedBuyerIdentity === undefined
      ? orderUsers.get(input.orderId) ?? null
      : input.merchantProvidedBuyerIdentity,
    internalOrderId: input.internalOrderId === undefined ? input.orderId : input.internalOrderId,
    refundTicketMerchantExternalId: input.refundTicketMerchantExternalId ?? null,
    providerOrderId: input.providerOrderId ?? `ORD_${input.orderId}`,
    providerPaymentId: input.providerPaymentId === undefined ? `PAY_${input.orderId}` : input.providerPaymentId,
    productKey: input.productKey === undefined ? "three" : input.productKey,
    providerProductId: input.providerProductId === undefined ? "PROD_test_three" : input.providerProductId,
    currency: input.currency ?? "USD",
    amountMinor: input.amountMinor ?? 699,
    taxAmount: input.taxAmount ?? "0.00",
    total: input.total ?? "6.99",
    payloadSha256: `hash-${suffix}`,
    canonicalPayloadSha256: "",
    supported: true,
    manualReviewReason: null,
  };
  event.canonicalPayloadSha256 = canonicalWaffoPayloadHash(event);
  return event;
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
  orderUsers.set(result.order.id, userId);
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
          'entitlement_batches', 'entitlement_ledger', 'payment_financial_reviews',
          'payment_checkout_budgets', 'payment_webhook_conflicts'
        )
      order by table_name
    `;
    expect(tables.map((row) => row.table_name)).toEqual([
      "entitlement_batches",
      "entitlement_ledger",
      "payment_checkout_budgets",
      "payment_financial_reviews",
      "payment_orders",
      "payment_outbox",
      "payment_webhook_conflicts",
      "payment_webhook_inbox",
    ]);

    const migrations = await sql<{ count: string }[]>`
      select count(*)::text as count from drizzle.__drizzle_migrations
    `;
    expect(migrations[0]?.count).toBe("8");
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

    await expect(sql`
      insert into payment_orders (
        id, user_id, product_key, quantity, amount_minor, currency, request_id,
        provider, provider_environment, provider_product_id, status
      ) values (
        ${randomUUID()}, ${userId}, 'three', 3, 699, 'USD', ${`paid-without-ids-${suffix}`},
        'waffo', 'test', 'PROD_test_three', 'paid'
      )
    `).rejects.toThrow();

    await sql`
      insert into payment_webhook_inbox (
        id, provider, provider_environment, delivery_id, event_id, event_type,
        store_id, order_merchant_external_id, linked_order_id, payload_sha256,
        canonical_payload_sha256, normalized_payload,
        signature_verified_at, status
      ) values (
        ${inboxId}, 'waffo', 'test', ${`delivery-${suffix}`}, ${`PAY_${suffix}`},
        'order.completed', 'STO_test', ${orderId}, ${orderId}, 'hash-one', 'legacy:v1:hash-one', ${JSON.stringify({ orderId })}::jsonb,
        now(), 'received'
      )
    `;
    await sql`
      insert into payment_outbox (
        id, inbox_id, order_id, topic, status, available_at, created_at, updated_at
      ) values (
        ${randomUUID()}, ${inboxId}, ${orderId}, 'grant_entitlement', 'pending', now(), now(), now()
      )
    `;
    await expect(sql`
      insert into payment_outbox (
        id, inbox_id, order_id, topic, status, available_at, created_at, updated_at
      ) values (
        ${randomUUID()}, ${inboxId}, ${orderId}, 'financial_review', 'pending', now(), now(), now()
      )
    `).rejects.toThrow();
    await expect(sql`
      insert into payment_webhook_inbox (
        id, provider, provider_environment, delivery_id, event_id, event_type,
        store_id, order_merchant_external_id, payload_sha256, canonical_payload_sha256, normalized_payload,
        signature_verified_at, status
      ) values (
        ${randomUUID()}, 'waffo', 'test', ${`delivery-${suffix}-other`}, ${`PAY_${suffix}`},
        'order.completed', 'STO_test', ${orderId}, 'hash-two', 'legacy:v1:hash-two', ${JSON.stringify({ orderId })}::jsonb,
        now(), 'received'
      )
    `).rejects.toThrow();

    await sql`
      insert into entitlement_batches (
        id, user_id, order_id, quantity_total, quantity_available,
        quantity_reserved, quantity_consumed, quantity_revoked, expires_at
      ) values (${batchId}, ${userId}, ${orderId}, 3, 3, 0, 0, 0, now() + interval '12 months')
    `;
    await sql`
      update payment_orders
      set provider_order_id = 'ORD_write_once', provider_payment_id = 'PAY_write_once',
          status = 'paid', paid_at = now()
      where id = ${orderId}
    `;
    await expect(sql`
      update payment_orders set provider_order_id = 'ORD_changed' where id = ${orderId}
    `).rejects.toThrow();
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

    await expect(sql`
      insert into entitlement_ledger (
        id, batch_id, order_id, webhook_inbox_id, action, quantity, business_key
      ) values (
        ${randomUUID()}, ${batchId}, ${randomUUID()}, ${inboxId}, 'consume', 1, ${`cross-order-${suffix}`}
      )
    `).rejects.toThrow();

    const nullLinkedInboxId = randomUUID();
    await sql`
      insert into payment_webhook_inbox (
        id, provider, provider_environment, delivery_id, event_id, event_type,
        store_id, order_merchant_external_id, payload_sha256, canonical_payload_sha256, normalized_payload,
        signature_verified_at, status
      ) values (
        ${nullLinkedInboxId}, 'waffo', 'test', ${`delivery-${suffix}-null`}, ${`PAY_${suffix}-null`},
        'order.completed', 'STO_test', ${orderId}, 'hash-null', 'legacy:v1:hash-null', ${JSON.stringify({ orderId })}::jsonb,
        now(), 'received'
      )
    `;
    await expect(sql`
      insert into payment_outbox (
        id, inbox_id, order_id, topic, status, available_at, created_at, updated_at
      ) values (
        ${randomUUID()}, ${nullLinkedInboxId}, ${orderId}, 'grant_entitlement', 'pending', now(), now(), now()
      )
    `).rejects.toThrow();
    await sql`
      insert into payment_outbox (
        id, inbox_id, order_id, topic, status, available_at, created_at, updated_at
      ) values (
        ${randomUUID()}, ${nullLinkedInboxId}, null, 'grant_entitlement', 'pending', now(), now(), now()
      )
    `;
    await expect(sql`
      insert into entitlement_ledger (
        id, batch_id, order_id, webhook_inbox_id, action, quantity, business_key
      ) values (
        ${randomUUID()}, ${batchId}, ${orderId}, ${nullLinkedInboxId}, 'consume', 1, ${`null-linked-${suffix}`}
      )
    `).rejects.toThrow();
    await expect(sql`
      update payment_webhook_inbox set linked_order_id = ${orderId} where id = ${nullLinkedInboxId}
    `).rejects.toThrow();
    await expect(sql`
      update payment_webhook_inbox set linked_order_id = ${randomUUID()} where id = ${inboxId}
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

  it("enforces the persistent non-terminal purchase-intent cap under concurrent requests", async () => {
    const suffix = randomUUID();
    const userId = `cp4-intent-limit-user-${suffix}`;
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (${userId}, 'Intent Limit User', ${`${suffix}@intent-limit.example.com`}, true, now(), now())
    `;
    const requests = Array.from({ length: 4 }, (_, index) => ({
      userId,
      productKey: "one" as const,
      quantity: 1,
      amountMinor: 299,
      currency: "USD" as const,
      requestId: `intent-${index}-${suffix}`,
      providerEnvironment: "test" as const,
      providerProductId: "PROD_test_one",
    }));
    const results = await Promise.allSettled(requests.map((input) => repository.createOrGetOrder(input)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    expect(results.filter((result) => result.status === "rejected").map((result) => (
      result.status === "rejected" ? result.reason?.message : null
    ))).toEqual(["PAYMENT_CHECKOUT_INTENT_LIMITED"]);
  });

  it("does not count expired checkout-created intents against the active purchase cap", async () => {
    const suffix = randomUUID();
    const userId = `cp4-expired-intent-user-${suffix}`;
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (${userId}, 'Expired Intent User', ${`${suffix}@expired-intent.example.com`}, true, now(), now())
    `;
    for (let index = 0; index < 3; index += 1) {
      const result = await repository.createOrGetOrder({
        userId,
        productKey: "one",
        quantity: 1,
        amountMinor: 299,
        currency: "USD",
        requestId: `expired-${index}-${suffix}`,
        providerEnvironment: "test",
        providerProductId: "PROD_test_one",
      });
      const claimToken = `expired-claim-${index}-${suffix}`;
      await repository.claimCheckoutInitialization({ orderId: result.order.id, claimToken, leaseDurationMs: 120_000 });
      await repository.saveCheckout({
        orderId: result.order.id,
        claimToken,
        providerCheckoutSessionId: `cs-expired-${index}-${suffix}`,
        providerCheckoutUrl: `https://pancake.waffo.ai/checkout/expired-${index}#token=expired-${index}`,
        checkoutExpiresAt: new Date(Date.now() + 60_000),
      });
      await sql`
        update payment_orders
        set checkout_expires_at = clock_timestamp() - interval '1 second'
        where id = ${result.order.id}
      `;
    }
    await expect(repository.createOrGetOrder({
      userId,
      productKey: "one",
      quantity: 1,
      amountMinor: 299,
      currency: "USD",
      requestId: `expired-new-${suffix}`,
      providerEnvironment: "test",
      providerProductId: "PROD_test_one",
    })).resolves.toMatchObject({ created: true });
  });

  it("enforces five persisted checkout attempts per ten-minute window after intents become terminal", async () => {
    const suffix = randomUUID();
    const userId = `cp4-rate-limit-user-${suffix}`;
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (${userId}, 'Rate Limit User', ${`${suffix}@rate-limit.example.com`}, true, now(), now())
    `;
    const orders = [] as string[];
    for (let index = 0; index < 5; index += 1) {
      const result = await repository.createOrGetOrder({
        userId,
        productKey: "one",
        quantity: 1,
        amountMinor: 299,
        currency: "USD",
        requestId: `rate-${index}-${suffix}`,
        providerEnvironment: "test",
        providerProductId: "PROD_test_one",
      });
      orders.push(result.order.id);
      await sql`
        update payment_orders
        set provider_order_id = ${`ORD_rate_${index}`}, provider_payment_id = ${`PAY_rate_${index}`},
            status = 'paid', paid_at = clock_timestamp(), updated_at = clock_timestamp()
        where id = ${result.order.id}
      `;
    }
    await expect(repository.createOrGetOrder({
      userId,
      productKey: "one",
      quantity: 1,
      amountMinor: 299,
      currency: "USD",
      requestId: `rate-six-${suffix}`,
      providerEnvironment: "test",
      providerProductId: "PROD_test_one",
    })).rejects.toThrow("PAYMENT_CHECKOUT_RATE_LIMITED");
    expect(orders).toHaveLength(5);
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

  it("fences an expired checkout claim to financial review before another request can retry", async () => {
    const { order } = await createUserAndOrder();
    const claimToken = `claim-${randomUUID()}`;
    await repository.claimCheckoutInitialization({
      orderId: order.id,
      claimToken,
      leaseDurationMs: 120_000,
    });
    await sql`
      update payment_orders
      set checkout_claim_expires_at = clock_timestamp() - interval '1 second'
      where id = ${order.id}
    `;

    const recovered = await repository.createOrGetOrder({
      userId: order.userId,
      productKey: order.productKey,
      quantity: order.quantity,
      amountMinor: order.amountMinor,
      currency: order.currency,
      requestId: order.requestId,
      providerEnvironment: order.providerEnvironment,
      providerProductId: order.providerProductId,
    });
    expect(recovered.order).toMatchObject({
      status: "financial_review",
      checkoutErrorCode: "CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN",
    });
  });

  it("rejects stale workers from saving or failing after their checkout lease expires", async () => {
    const { order } = await createUserAndOrder();
    const claimToken = `claim-${randomUUID()}`;
    await repository.claimCheckoutInitialization({ orderId: order.id, claimToken, leaseDurationMs: 120_000 });
    await sql`
      update payment_orders
      set checkout_claim_expires_at = clock_timestamp() - interval '1 second'
      where id = ${order.id}
    `;

    await expect(repository.saveCheckout({
      orderId: order.id,
      claimToken,
      providerCheckoutSessionId: "cs_stale",
      providerCheckoutUrl: "https://pancake.waffo.ai/checkout/cs_stale#token=secret",
      checkoutExpiresAt: new Date(Date.now() + 60_000),
    })).rejects.toThrow("PAYMENT_CHECKOUT_CLAIM_INVALID");
    await expect(repository.failCheckoutInitialization({
      orderId: order.id,
      claimToken,
      errorCode: "CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN",
    })).rejects.toThrow("PAYMENT_CHECKOUT_CLAIM_INVALID");
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
    const stored = await sql<{ provider_checkout_url: string }[]>`
      select provider_checkout_url from payment_orders where id = ${order.id}
    `;
    expect(stored[0]?.provider_checkout_url).toMatch(/^enc:v1:/);
    expect(stored[0]?.provider_checkout_url).not.toContain("#token=redirect");
    expect(saved.providerCheckoutUrl).toBe("https://pancake.waffo.ai/checkout/session#token=redirect");
    const payment = await repository.recordVerifiedEvent(paymentEvent({ orderId: order.id }));
    await repository.processInbox(payment.inboxId);
    const terminalStorage = await sql<{ provider_checkout_url: string | null }[]>`
      select provider_checkout_url from payment_orders where id = ${order.id}
    `;
    expect(terminalStorage[0]?.provider_checkout_url).toBeNull();
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

  it("persists a delivery conflict instead of returning the original Inbox as a success", async () => {
    const { order } = await createUserAndOrder();
    const original = paymentEvent({ orderId: order.id, deliveryId: `delivery-${randomUUID()}` });
    await repository.recordVerifiedEvent(original);

    await expect(repository.recordVerifiedEvent({
      ...original,
      payloadSha256: `conflict-${randomUUID()}`,
    })).rejects.toThrow("WEBHOOK_DELIVERY_CONFLICT");
    const conflicts = await sql<{ count: string }[]>`
      select count(*)::text as count
      from payment_webhook_conflicts
      where existing_order_id = ${order.id}
    `;
    expect(conflicts[0]?.count).toBe("1");
  });

  it("routes a canonical business-event conflict to financial review", async () => {
    const { order } = await createUserAndOrder();
    const original = paymentEvent({ orderId: order.id, eventId: "PAY_CANONICAL_CONFLICT" });
    const recorded = await repository.recordVerifiedEvent(original);
    await expect(repository.recordVerifiedEvent({
      ...original,
      deliveryId: `delivery-${randomUUID()}`,
      amountMinor: 698,
      payloadSha256: `different-${randomUUID()}`,
    })).rejects.toThrow("WEBHOOK_BUSINESS_EVENT_CONFLICT");
    const conflict = await sql<{ count: string; status: string }[]>`
      select
        (select count(*) from payment_webhook_conflicts where existing_inbox_id = ${recorded.inboxId})::text as count,
        (select status from payment_orders where id = ${order.id}) as status
    `;
    expect(conflict).toEqual([{ count: "1", status: "financial_review" }]);
  });

  it.each([
    ["tax", { taxAmount: "0.01" }],
    ["total", { total: "7.00" }],
  ])("treats a business-event %s correction as a canonical conflict", async (_field, override) => {
    const { order } = await createUserAndOrder();
    const original = paymentEvent({ orderId: order.id, eventId: `PAY_FINANCIAL_${randomUUID()}` });
    await repository.recordVerifiedEvent(original);
    await expect(repository.recordVerifiedEvent({
      ...original,
      ...override,
      deliveryId: `delivery-${randomUUID()}`,
      payloadSha256: `different-${randomUUID()}`,
    })).rejects.toThrow("WEBHOOK_BUSINESS_EVENT_CONFLICT");
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

  it.each([
    ["PAYMENT_BUYER_IDENTITY_MISMATCH", { merchantProvidedBuyerIdentity: "different-user" }],
    ["PAYMENT_INTERNAL_ORDER_ID_MISMATCH", { internalOrderId: randomUUID() }],
    ["PAYMENT_INTERNAL_ORDER_ID_MISSING", { internalOrderId: null }],
  ])("fails closed for webhook purchase binding: %s", async (reason, override) => {
    const { order } = await createUserAndOrder();
    const recorded = await repository.recordVerifiedEvent(paymentEvent({ orderId: order.id, ...override }));
    await expect(repository.processInbox(recorded.inboxId)).resolves.toMatchObject({
      outcome: "financial_review",
      reason,
    });
    const grants = await sql<{ count: string }[]>`
      select count(*)::text as count from entitlement_ledger
      where order_id = ${order.id} and action = 'grant'
    `;
    expect(grants[0]?.count).toBe("0");
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

  it("does not silently ignore a new payment event after refund", async () => {
    const { order } = await createUserAndOrder();
    const paid = await repository.recordVerifiedEvent(paymentEvent({ orderId: order.id }));
    await repository.processInbox(paid.inboxId);
    const refund = await repository.recordVerifiedEvent(paymentEvent({ orderId: order.id, type: "refund.succeeded" }));
    await repository.processInbox(refund.inboxId);

    const late = await repository.recordVerifiedEvent(paymentEvent({
      orderId: order.id,
      eventId: "PAY_LATE_AFTER_REFUND",
      providerOrderId: "ORD_new_payment",
      providerPaymentId: "PAY_new_payment",
    }));
    await expect(repository.processInbox(late.inboxId)).resolves.toMatchObject({
      outcome: "financial_review",
      reason: "PAYMENT_AFTER_REFUND",
    });
    const states = await sql<{ order_status: string; inbox_status: string; outbox_status: string }[]>`
      select o.status as order_status, i.status as inbox_status, x.status as outbox_status
      from payment_orders o
      join payment_webhook_inbox i on i.id = ${late.inboxId}
      join payment_outbox x on x.inbox_id = i.id
      where o.id = ${order.id}
    `;
    expect(states).toEqual([{ order_status: "refunded", inbox_status: "financial_review", outbox_status: "completed" }]);
  });

  it("checks provider identity before treating a new refund for a refunded order as processed", async () => {
    const { order } = await createUserAndOrder();
    const paid = await repository.recordVerifiedEvent(paymentEvent({ orderId: order.id }));
    await repository.processInbox(paid.inboxId);
    const refund = await repository.recordVerifiedEvent(paymentEvent({ orderId: order.id, type: "refund.succeeded" }));
    await repository.processInbox(refund.inboxId);
    const lateRefund = await repository.recordVerifiedEvent(paymentEvent({
      orderId: order.id,
      type: "refund.succeeded",
      eventId: `REF_BAD_AFTER_REFUND_${randomUUID()}`,
      providerOrderId: "ORD_wrong_refund",
      providerPaymentId: "PAY_wrong_refund",
    }));
    await expect(repository.processInbox(lateRefund.inboxId)).resolves.toMatchObject({
      outcome: "financial_review",
      reason: "REFUND_PROVIDER_ID_MISMATCH",
    });
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

  it("does not commit a payment grant when an out-of-order refund has mismatched provider identity", async () => {
    const { order } = await createUserAndOrder();
    const refund = await repository.recordVerifiedEvent(paymentEvent({
      orderId: order.id,
      type: "refund.succeeded",
      providerOrderId: "ORD_refund_wrong",
      providerPaymentId: "PAY_refund_wrong",
    }));
    await repository.processInbox(refund.inboxId);
    const paid = await repository.recordVerifiedEvent(paymentEvent({ orderId: order.id }));
    await expect(repository.processInbox(paid.inboxId)).resolves.toMatchObject({
      outcome: "financial_review",
    });
    const state = await sql<{ status: string; batches: string; available: string; refund_status: string }[]>`
      select
        o.status,
        (select count(*) from entitlement_batches where order_id = o.id)::text as batches,
        coalesce((select quantity_available::text from entitlement_batches where order_id = o.id), '0') as available,
        (select status from payment_webhook_inbox where id = ${refund.inboxId}) as refund_status
      from payment_orders o where o.id = ${order.id}
    `;
    expect(state).toEqual([{ status: "financial_review", batches: "0", available: "0", refund_status: "financial_review" }]);
  });

  it("keeps grant and already-verified refund settlement in one transaction", async () => {
    const { order } = await createUserAndOrder();
    const refund = await repository.recordVerifiedEvent(paymentEvent({
      orderId: order.id,
      type: "refund.succeeded",
    }));
    await repository.processInbox(refund.inboxId);
    const paid = await repository.recordVerifiedEvent(paymentEvent({ orderId: order.id }));
    const faultyRepository = new PostgresPaymentRepository(sql, {
      afterGrantBeforePendingRefund: () => {
        throw new Error("INJECTED_REFUND_SETTLEMENT_FAILURE");
      },
    });

    await expect(faultyRepository.processInbox(paid.inboxId)).rejects.toThrow("INJECTED_REFUND_SETTLEMENT_FAILURE");
    const state = await sql<{ status: string; batches: string; refund_status: string }[]>`
      select
        o.status,
        (select count(*) from entitlement_batches where order_id = o.id)::text as batches,
        (select status from payment_webhook_inbox where id = ${refund.inboxId}) as refund_status
      from payment_orders o where o.id = ${order.id}
    `;
    expect(state).toEqual([{ status: "pending", batches: "0", refund_status: "pending_order" }]);
  });

  it("does not expose granted credits while an already-verified refund is behind a transaction barrier", async () => {
    const { order } = await createUserAndOrder();
    const refund = await repository.recordVerifiedEvent(paymentEvent({ orderId: order.id, type: "refund.succeeded" }));
    await repository.processInbox(refund.inboxId);
    const paid = await repository.recordVerifiedEvent(paymentEvent({ orderId: order.id }));
    let releaseBarrier!: () => void;
    let enteredBarrier!: () => void;
    const barrierEntered = new Promise<void>((resolve) => { enteredBarrier = resolve; });
    const barrierReleased = new Promise<void>((resolve) => { releaseBarrier = resolve; });
    const barrierRepository = new PostgresPaymentRepository(sql, {
      beforePendingRefundSettlement: async () => {
        enteredBarrier();
        await barrierReleased;
      },
    });

    const paymentPromise = barrierRepository.processInbox(paid.inboxId);
    await barrierEntered;
    const visible = await sql<{ batches: string; available: string }[]>`
      select
        (select count(*) from entitlement_batches where order_id = ${order.id})::text as batches,
        coalesce((select quantity_available::text from entitlement_batches where order_id = ${order.id}), '0') as available
    `;
    expect(visible).toEqual([{ batches: "0", available: "0" }]);
    releaseBarrier();
    await expect(paymentPromise).resolves.toMatchObject({ outcome: "granted" });
    const settled = await sql<{ status: string; available: number; revoked: number }[]>`
      select o.status, b.quantity_available as available, b.quantity_revoked as revoked
      from payment_orders o join entitlement_batches b on b.order_id = o.id
      where o.id = ${order.id}
    `;
    expect(settled).toEqual([{ status: "refunded", available: 0, revoked: 3 }]);
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
    await expect(repository.processInbox(recorded.inboxId)).resolves.toMatchObject({ outcome: "dead_letter" });

    await expect(repository.replayDeadLetter(recorded.inboxId, "OPERATOR_REVIEWED"))
      .resolves.toBe(true);
    await expect(repository.processInbox(recorded.inboxId)).resolves.toMatchObject({ outcome: "granted" });
    const replayed = await sql<{ attempts: number; grants: string; replay_code: string }[]>`
      select i.attempt_count as attempts, i.last_error_code as replay_code,
        (select count(*) from entitlement_ledger l where l.webhook_inbox_id = i.id and l.action = 'grant')::text as grants
      from payment_webhook_inbox i where i.id = ${recorded.inboxId}
    `;
    expect(replayed).toEqual([{ attempts: 1, grants: "1", replay_code: null }]);
  });
});
