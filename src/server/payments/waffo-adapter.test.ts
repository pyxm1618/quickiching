import { describe, expect, it, vi } from "vitest";
import { CURRENCY } from "@/domain/entitlements/pricing";
import {
  createWaffoPaymentAdapter,
  resolveWaffoRuntimeConfig,
  resolveWaffoWebhookConfig,
} from "./waffo-adapter";

const runtimeEnv = {
  WAFFO_ENVIRONMENT: "test",
  WAFFO_MERCHANT_ID: "MER_test",
  WAFFO_PRIVATE_KEY: "private-key",
  WAFFO_STORE_ID: "STO_test",
  WAFFO_TEST_PRODUCT_ID_ONE: "PROD_test_one",
  WAFFO_TEST_PRODUCT_ID_THREE: "PROD_test_three",
  WAFFO_TEST_PRODUCT_ID_FIVE: "PROD_test_five",
  WAFFO_PROD_PRODUCT_ID_ONE: "PROD_prod_one",
  WAFFO_PROD_PRODUCT_ID_THREE: "PROD_prod_three",
  WAFFO_PROD_PRODUCT_ID_FIVE: "PROD_prod_five",
  APP_BASE_URL: "https://www.quickiching.com",
};

describe("Waffo 0.19.1 payment boundary", () => {
  it("resolves signed webhook verification without checkout credentials", () => {
    expect(resolveWaffoWebhookConfig({
      WAFFO_ENVIRONMENT: "test",
      WAFFO_STORE_ID: "STO_test",
    })).toEqual({ environment: "test", storeId: "STO_test" });
  });

  it("requires only the selected environment product map and accepts published IDs shared across environments", () => {
    const testOnlyEnvironment = { ...runtimeEnv } as Record<string, string | undefined>;
    delete testOnlyEnvironment.WAFFO_PROD_PRODUCT_ID_ONE;
    delete testOnlyEnvironment.WAFFO_PROD_PRODUCT_ID_THREE;
    delete testOnlyEnvironment.WAFFO_PROD_PRODUCT_ID_FIVE;
    expect(resolveWaffoRuntimeConfig(testOnlyEnvironment)).toMatchObject({
      environment: "test",
      storeId: "STO_test",
      productIds: {
        one: "PROD_test_one",
        three: "PROD_test_three",
        five: "PROD_test_five",
      },
    });

    const prodOnlyEnvironment = { ...runtimeEnv, WAFFO_ENVIRONMENT: "prod" } as Record<string, string | undefined>;
    delete prodOnlyEnvironment.WAFFO_TEST_PRODUCT_ID_ONE;
    delete prodOnlyEnvironment.WAFFO_TEST_PRODUCT_ID_THREE;
    delete prodOnlyEnvironment.WAFFO_TEST_PRODUCT_ID_FIVE;
    expect(resolveWaffoRuntimeConfig(prodOnlyEnvironment).productIds).toEqual({
      one: "PROD_prod_one",
      three: "PROD_prod_three",
      five: "PROD_prod_five",
    });

    expect(resolveWaffoRuntimeConfig({
      ...runtimeEnv,
      WAFFO_PROD_PRODUCT_ID_ONE: "PROD_test_one",
    }).productIds.one).toBe("PROD_test_one");

    expect(() => resolveWaffoRuntimeConfig({
      ...runtimeEnv,
      WAFFO_TEST_PRODUCT_ID_THREE: "PROD_test_one",
    })).toThrow("WAFFO_CONFIGURATION_UNAVAILABLE");
  });

  it("creates only authenticated fixed-product checkout without a client price override", async () => {
    const create = vi.fn(async (_input: unknown) => ({
      sessionId: "cs_test",
      checkoutUrl: "https://pancake.waffo.ai/store/test/checkout/cs_test#token=secret-token",
      expiresAt: "2026-08-24T02:00:00.000Z",
      token: "secret-token",
      tokenExpiresAt: "2026-08-24T01:20:00.000Z",
    }));
    const adapter = createWaffoPaymentAdapter(resolveWaffoRuntimeConfig(runtimeEnv), {
      checkout: { authenticated: { create } },
    }, () => new Date("2026-08-24T01:00:00.000Z"));

    const result = await adapter.createCheckout({
      orderId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "three",
    });

    expect(result).toEqual({
      sessionId: "cs_test",
      checkoutUrl: "https://pancake.waffo.ai/store/test/checkout/cs_test#token=secret-token",
      expiresAt: new Date("2026-08-24T01:20:00.000Z"),
    });
    expect(create).toHaveBeenCalledWith({
      productId: "PROD_test_three",
      currency: CURRENCY,
      buyerIdentity: "user-123",
      buyerEmail: "buyer@example.com",
      orderMerchantExternalId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
      successUrl: "https://www.quickiching.com/checkout/return",
      metadata: {
        internalOrderId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
        productKey: "three",
        providerProductId: "PROD_test_three",
      },
    });
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty("priceSnapshot");
    // No locale was supplied, so the cashier is left to infer its own language.
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty("language");
    expect(JSON.stringify(result)).not.toContain("tokenExpiresAt");
  });

  it("uses the session deadline when it is earlier than the token deadline", async () => {
    const create = vi.fn(async () => ({
      sessionId: "cs_test",
      checkoutUrl: "https://pancake.waffo.ai/store/test/checkout/cs_test#token=secret-token",
      expiresAt: "2026-08-24T01:20:00.000Z",
      token: "secret-token",
      tokenExpiresAt: "2026-08-24T02:00:00.000Z",
    }));
    const adapter = createWaffoPaymentAdapter(resolveWaffoRuntimeConfig(runtimeEnv), {
      checkout: { authenticated: { create } },
    }, () => new Date("2026-08-24T01:00:00.000Z"));

    await expect(adapter.createCheckout({
      orderId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "three",
    })).resolves.toMatchObject({ expiresAt: new Date("2026-08-24T01:20:00.000Z") });
  });

  it.each([
    ["invalid session expiry", { expiresAt: "not-a-date", tokenExpiresAt: "2026-08-24T02:00:00.000Z" }],
    ["invalid token expiry", { expiresAt: "2026-08-24T02:00:00.000Z", tokenExpiresAt: "not-a-date" }],
    ["expired session", { expiresAt: "2026-08-23T23:59:00.000Z", tokenExpiresAt: "2026-08-24T02:00:00.000Z" }],
    ["expired token", { expiresAt: "2026-08-24T02:00:00.000Z", tokenExpiresAt: "2026-08-23T23:59:00.000Z" }],
  ])("fails closed for %s", async (_label, expiry) => {
    const adapter = createWaffoPaymentAdapter(resolveWaffoRuntimeConfig(runtimeEnv), {
      checkout: {
        authenticated: {
          create: vi.fn(async () => ({
            sessionId: "cs_test",
            checkoutUrl: "https://pancake.waffo.ai/store/test/checkout/cs_test#token=secret-token",
            token: "secret-token",
            ...expiry,
          })),
        },
      },
    }, () => new Date("2026-08-24T01:00:00.000Z"));

    await expect(adapter.createCheckout({
      orderId: "8b6d8846-cdce-4dde-9744-817b8329a5fb",
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "one",
    })).rejects.toThrow("WAFFO_PROVIDER_RESPONSE_INVALID");
  });

  it.each([
    "javascript:alert(1)",
    "https://pancake.waffo.ai.evil.example/checkout/cs_test#token=secret-token",
    "https://pancake.waffo.ai:8443/checkout/cs_test#token=secret-token",
    "https://user:password@pancake.waffo.ai/checkout/cs_test#token=secret-token",
  ])("rejects a provider checkout URL outside the official HTTPS hostname allowlist: %s", async (checkoutUrl) => {
    const adapter = createWaffoPaymentAdapter(resolveWaffoRuntimeConfig(runtimeEnv), {
      checkout: {
        authenticated: {
          create: vi.fn(async () => ({
            sessionId: "cs_test",
            checkoutUrl,
            expiresAt: "2026-08-24T02:00:00.000Z",
            token: "secret-token",
            tokenExpiresAt: "2026-08-24T01:20:00.000Z",
          })),
        },
      },
    }, () => new Date("2026-08-24T01:00:00.000Z"));

    await expect(adapter.createCheckout({
      orderId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "one",
    })).rejects.toThrow("WAFFO_PROVIDER_RESPONSE_INVALID");
  });
});

describe("Waffo post-payment return URL", () => {
  function checkoutSpy() {
    return vi.fn(async (_input: unknown) => ({
      sessionId: "cs_test",
      checkoutUrl: "https://pancake.waffo.ai/store/test/checkout/cs_test#token=secret-token",
      expiresAt: "2026-08-24T02:00:00.000Z",
      token: "secret-token",
      tokenExpiresAt: "2026-08-24T01:50:00.000Z",
    }));
  }

  function adapterFor(env: Record<string, string | undefined>, create = checkoutSpy()) {
    return {
      create,
      adapter: createWaffoPaymentAdapter(resolveWaffoRuntimeConfig(env), {
        checkout: { authenticated: { create } },
      }, () => new Date("2026-08-24T01:00:00.000Z")),
    };
  }

  function purchase(adapter: ReturnType<typeof adapterFor>["adapter"], locale?: "en" | "zh-Hans") {
    return adapter.createCheckout({
      orderId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "one",
      ...(locale ? { locale } : {}),
    });
  }

  it("derives the return URL from APP_BASE_URL", () => {
    expect(resolveWaffoRuntimeConfig(runtimeEnv).successUrl)
      .toBe("https://www.quickiching.com/checkout/return");
  });

  it("keeps the return URL on the configured origin regardless of the base path", () => {
    expect(resolveWaffoRuntimeConfig({ ...runtimeEnv, APP_BASE_URL: "https://staging.quickiching.com/anything" }).successUrl)
      .toBe("https://staging.quickiching.com/checkout/return");
  });

  it("sends the return URL on every checkout", async () => {
    const { adapter, create } = adapterFor(runtimeEnv);

    await purchase(adapter);

    expect(create.mock.calls[0]?.[0]).toMatchObject({
      successUrl: "https://www.quickiching.com/checkout/return",
    });
  });

  it("carries no order identity in the return URL", async () => {
    const { adapter, create } = adapterFor(runtimeEnv);

    await purchase(adapter);

    const url = new URL((create.mock.calls[0]?.[0] as { successUrl: string }).successUrl);
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
    expect(url.pathname).toBe("/checkout/return");
  });

  it.each([
    ["missing", undefined],
    ["blank", "   "],
    ["not a URL", "not-a-url"],
    ["a non-HTTP scheme", "ftp://www.quickiching.com"],
    ["credentials in the authority", "https://user:pass@www.quickiching.com"],
  ])("fails closed when APP_BASE_URL is %s", (_label, appBaseUrl) => {
    expect(() => resolveWaffoRuntimeConfig({ ...runtimeEnv, APP_BASE_URL: appBaseUrl }))
      .toThrow("WAFFO_CONFIGURATION_UNAVAILABLE");
  });

  it.each([
    ["en", "en"],
    ["zh-Hans", "zh-Hans"],
  ])("passes %s through as the cashier's default language", async (locale, expected) => {
    const { adapter, create } = adapterFor(runtimeEnv);

    await purchase(adapter, locale as "en" | "zh-Hans");

    expect(create.mock.calls[0]?.[0]).toMatchObject({ language: expected });
  });
});
