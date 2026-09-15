import { describe, expect, it, vi } from "vitest";
import {
  CheckoutServiceError,
  createCheckoutService,
  type CheckoutOrderRecord,
  type CheckoutRepository,
} from "./checkout-service";

function order(overrides: Partial<CheckoutOrderRecord> = {}): CheckoutOrderRecord {
  return {
    id: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
    userId: "user-123",
    productKey: "three",
    quantity: 3,
    amountMinor: 699,
    currency: "USD",
    requestId: "request-1234567890",
    providerEnvironment: "test",
    providerProductId: "PROD_test_three",
    providerCheckoutSessionId: null,
    providerCheckoutUrl: null,
    checkoutExpiresAt: null,
    checkoutClaimExpiresAt: null,
    checkoutErrorCode: null,
    status: "pending",
    ...overrides,
  };
}

describe("checkout service", () => {
  it("derives quantity, amount, currency, and provider product entirely on the server", async () => {
    const created = order();
    const createInputs: unknown[] = [];
    const savedInputs: unknown[] = [];
    const claimInputs: unknown[] = [];
    const repository: CheckoutRepository = {
      createOrGetOrder: async (input) => {
        createInputs.push(input);
        return { order: created, created: true };
      },
      claimCheckoutInitialization: async (input) => {
        claimInputs.push(input);
        return true;
      },
      saveCheckout: async (input) => {
        savedInputs.push(input);
        return order({
          providerCheckoutSessionId: input.providerCheckoutSessionId,
          providerCheckoutUrl: input.providerCheckoutUrl,
          checkoutExpiresAt: input.checkoutExpiresAt,
          status: "checkout_created",
        });
      },
      failCheckoutInitialization: async () => undefined,
    };
    const providerInputs: unknown[] = [];
    const service = createCheckoutService({
      repository,
      provider: {
        createCheckout: async (input) => {
          providerInputs.push(input);
          return {
            sessionId: "cs_test",
            checkoutUrl: "https://pancake.waffo.ai/checkout/cs_test#token=secret",
            expiresAt: new Date("2026-08-24T02:00:00.000Z"),
          };
        },
      },
      environment: "test",
      productIds: { one: "PROD_test_one", three: "PROD_test_three", five: "PROD_test_five" },
    });

    const result = await service.create({
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "three",
      requestId: "request-1234567890",
    });

    expect(createInputs).toEqual([{
      userId: "user-123",
      productKey: "three",
      quantity: 3,
      amountMinor: 699,
      currency: "USD",
      requestId: "request-1234567890",
      providerEnvironment: "test",
      providerProductId: "PROD_test_three",
    }]);
    expect(providerInputs).toEqual([{
      orderId: created.id,
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "three",
    }]);
    expect(claimInputs).toEqual([expect.objectContaining({
      orderId: created.id,
      claimToken: expect.any(String),
      leaseDurationMs: 120_000,
    })]);
    expect(savedInputs).toHaveLength(1);
    expect(savedInputs[0]).toEqual(expect.objectContaining({ claimToken: expect.any(String) }));
    expect(result).toEqual({
      orderId: created.id,
      checkoutUrl: "https://pancake.waffo.ai/checkout/cs_test#token=secret",
      expiresAt: new Date("2026-08-24T02:00:00.000Z"),
    });
  });

  it("returns an unexpired stored checkout without reinitializing the provider", async () => {
    let providerCalls = 0;
    const stored = order({
      status: "checkout_created",
      providerCheckoutSessionId: "cs_stored",
      providerCheckoutUrl: "https://pancake.waffo.ai/checkout/cs_stored#token=stored",
      checkoutExpiresAt: new Date("2026-08-24T02:00:00.000Z"),
    });
    const service = createCheckoutService({
      repository: {
        createOrGetOrder: async () => ({ order: stored, created: false }),
        claimCheckoutInitialization: async () => { throw new Error("must not claim"); },
        saveCheckout: async () => { throw new Error("must not save"); },
        failCheckoutInitialization: async () => { throw new Error("must not fail"); },
      },
      provider: {
        createCheckout: async () => {
          providerCalls += 1;
          throw new Error("must not call provider");
        },
      },
      environment: "test",
      productIds: { one: "PROD_test_one", three: "PROD_test_three", five: "PROD_test_five" },
      now: () => new Date("2026-08-24T01:00:00.000Z"),
    });

    await expect(service.create({
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "three",
      requestId: "request-1234567890",
    })).resolves.toEqual({
      orderId: stored.id,
      checkoutUrl: stored.providerCheckoutUrl,
      expiresAt: stored.checkoutExpiresAt,
    });
    expect(providerCalls).toBe(0);
  });

  it.each(["paid", "refunded"] as const)("does not return a stored URL for %s orders", async (status) => {
    const stored = order({
      status,
      providerCheckoutSessionId: "cs_terminal",
      providerCheckoutUrl: "https://pancake.waffo.ai/checkout/cs_terminal#token=secret",
      checkoutExpiresAt: new Date("2099-08-24T02:00:00.000Z"),
    });
    const provider = vi.fn(async () => ({
      sessionId: "must-not-create",
      checkoutUrl: "https://pancake.waffo.ai/checkout/must-not-create#token=secret",
      expiresAt: new Date("2099-08-24T02:00:00.000Z"),
    }));
    const service = createCheckoutService({
      repository: {
        createOrGetOrder: async () => ({ order: stored, created: false }),
        claimCheckoutInitialization: async () => false,
        saveCheckout: async () => { throw new Error("must not save"); },
        failCheckoutInitialization: async () => { throw new Error("must not fail"); },
      },
      provider: { createCheckout: provider },
      environment: "test",
      productIds: { one: "PROD_test_one", three: "PROD_test_three", five: "PROD_test_five" },
      now: () => new Date("2099-08-24T01:00:00.000Z"),
    });

    await expect(service.create({
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "three",
      requestId: "request-1234567890",
    })).rejects.toMatchObject({ code: "CHECKOUT_TERMINAL_ORDER", retryable: false });
    expect(provider).not.toHaveBeenCalled();
  });

  it("returns a stable non-retryable uncertainty error for a financial-review order", async () => {
    const service = createCheckoutService({
      repository: {
        createOrGetOrder: async () => ({ order: order({
          status: "financial_review",
          checkoutErrorCode: "CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN",
        }), created: false }),
        claimCheckoutInitialization: async () => false,
        saveCheckout: async () => { throw new Error("must not save"); },
        failCheckoutInitialization: async () => { throw new Error("must not fail"); },
      },
      provider: { createCheckout: async () => { throw new Error("must not call"); } },
      environment: "test",
      productIds: { one: "PROD_test_one", three: "PROD_test_three", five: "PROD_test_five" },
      now: () => new Date("2099-08-24T01:00:00.000Z"),
    });

    await expect(service.create({
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "three",
      requestId: "request-1234567890",
    })).rejects.toMatchObject({ code: "CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN", retryable: false });
  });

  it("does not retry an expired checkout-created session", async () => {
    const provider = vi.fn();
    const service = createCheckoutService({
      repository: {
        createOrGetOrder: async () => ({ order: order({
          status: "checkout_created",
          providerCheckoutSessionId: "cs_expired",
          providerCheckoutUrl: "https://pancake.waffo.ai/checkout/cs_expired#token=secret",
          checkoutExpiresAt: new Date("2099-08-24T00:59:00.000Z"),
        }), created: false }),
        claimCheckoutInitialization: async () => false,
        saveCheckout: async () => { throw new Error("must not save"); },
        failCheckoutInitialization: async () => { throw new Error("must not fail"); },
      },
      provider: { createCheckout: provider },
      environment: "test",
      productIds: { one: "PROD_test_one", three: "PROD_test_three", five: "PROD_test_five" },
      now: () => new Date("2099-08-24T01:00:00.000Z"),
    });

    await expect(service.create({
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "three",
      requestId: "request-1234567890",
    })).rejects.toMatchObject({ code: "CHECKOUT_EXPIRED", retryable: false });
    expect(provider).not.toHaveBeenCalled();
  });

  it("does not call the provider while another checkout claim is still leased", async () => {
    const provider = vi.fn();
    const service = createCheckoutService({
      repository: {
        createOrGetOrder: async () => ({ order: order({
          status: "checkout_initializing",
          checkoutClaimExpiresAt: new Date("2099-08-24T01:10:00.000Z"),
        }), created: false }),
        claimCheckoutInitialization: async () => false,
        saveCheckout: async () => { throw new Error("must not save"); },
        failCheckoutInitialization: async () => { throw new Error("must not fail"); },
      },
      provider: { createCheckout: provider },
      environment: "test",
      productIds: { one: "PROD_test_one", three: "PROD_test_three", five: "PROD_test_five" },
      now: () => new Date("2099-08-24T01:00:00.000Z"),
    });

    await expect(service.create({
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "three",
      requestId: "request-1234567890",
    })).rejects.toMatchObject({ code: "CHECKOUT_IN_PROGRESS", retryable: true });
    expect(provider).not.toHaveBeenCalled();
  });

  it("freezes a provider hang as non-retryable unknown outcome after the overall timeout", async () => {
    const failures: unknown[] = [];
    const service = createCheckoutService({
      repository: {
        createOrGetOrder: async () => ({ order: order(), created: true }),
        claimCheckoutInitialization: async () => true,
        saveCheckout: async () => { throw new Error("must not save"); },
        failCheckoutInitialization: async (input) => { failures.push(input); },
      },
      provider: { createCheckout: () => new Promise((resolve) => setTimeout(() => resolve({
        sessionId: "late-session",
        checkoutUrl: "https://pancake.waffo.ai/checkout/late#token=secret",
        expiresAt: new Date("2099-08-24T02:00:00.000Z"),
      }), 50)) },
      environment: "test",
      productIds: { one: "PROD_test_one", three: "PROD_test_three", five: "PROD_test_five" },
      providerTimeoutMs: 10,
    });

    await expect(service.create({
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "three",
      requestId: "request-1234567890",
    })).rejects.toMatchObject({ code: "CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN", retryable: false });
    expect(failures).toEqual([expect.objectContaining({ errorCode: "CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN" })]);
  });

  it("rejects malformed product and idempotency input before persistence", async () => {
    let repositoryCalls = 0;
    const service = createCheckoutService({
      repository: {
        createOrGetOrder: async () => {
          repositoryCalls += 1;
          return { order: order(), created: true };
        },
        claimCheckoutInitialization: async () => true,
        saveCheckout: async () => order(),
        failCheckoutInitialization: async () => undefined,
      },
      provider: { createCheckout: async () => { throw new Error("must not call"); } },
      environment: "test",
      productIds: { one: "PROD_test_one", three: "PROD_test_three", five: "PROD_test_five" },
    });

    await expect(service.create({
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "ten",
      requestId: "short",
    })).rejects.toMatchObject({ code: "CHECKOUT_REQUEST_INVALID" });
    expect(repositoryCalls).toBe(0);
  });

  it("exposes only typed safe error codes", () => {
    const error = new CheckoutServiceError("CHECKOUT_IDEMPOTENCY_CONFLICT", false);
    expect(error).toMatchObject({ code: "CHECKOUT_IDEMPOTENCY_CONFLICT", retryable: false });
    expect(JSON.stringify(error)).not.toContain("private");
  });

  it("does not call Waffo without the unique database claim", async () => {
    let providerCalls = 0;
    const service = createCheckoutService({
      repository: {
        createOrGetOrder: async () => ({ order: order(), created: false }),
        claimCheckoutInitialization: async () => false,
        saveCheckout: async () => { throw new Error("must not save"); },
        failCheckoutInitialization: async () => { throw new Error("must not fail"); },
      },
      provider: { createCheckout: async () => {
        providerCalls += 1;
        throw new Error("must not call");
      } },
      environment: "test",
      productIds: { one: "PROD_test_one", three: "PROD_test_three", five: "PROD_test_five" },
    });

    await expect(service.create({
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "three",
      requestId: "request-1234567890",
    })).rejects.toMatchObject({ code: "CHECKOUT_UNAVAILABLE", retryable: true });
    expect(providerCalls).toBe(0);
  });

  it("freezes an ambiguous provider outcome instead of automatically creating another checkout", async () => {
    const failures: unknown[] = [];
    const service = createCheckoutService({
      repository: {
        createOrGetOrder: async () => ({ order: order(), created: true }),
        claimCheckoutInitialization: async () => true,
        saveCheckout: async () => { throw new Error("must not save"); },
        failCheckoutInitialization: async (input) => { failures.push(input); },
      },
      provider: { createCheckout: async () => { throw new Error("network outcome unknown"); } },
      environment: "test",
      productIds: { one: "PROD_test_one", three: "PROD_test_three", five: "PROD_test_five" },
    });

    await expect(service.create({
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "three",
      requestId: "request-1234567890",
    })).rejects.toMatchObject({ code: "CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN", retryable: false });
    expect(failures).toEqual([expect.objectContaining({
      orderId: order().id,
      claimToken: expect.any(String),
      errorCode: "CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN",
    })]);
  });
});
