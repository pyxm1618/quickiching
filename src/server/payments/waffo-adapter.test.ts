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
};

describe("Waffo 0.19.1 payment boundary", () => {
  it("resolves signed webhook verification without checkout credentials", () => {
    expect(resolveWaffoWebhookConfig({
      WAFFO_ENVIRONMENT: "test",
      WAFFO_STORE_ID: "STO_test",
    })).toEqual({ environment: "test", storeId: "STO_test" });
  });

  it("selects an environment-specific product map and never aliases Test to Prod", () => {
    expect(resolveWaffoRuntimeConfig(runtimeEnv)).toMatchObject({
      environment: "test",
      storeId: "STO_test",
      productIds: {
        one: "PROD_test_one",
        three: "PROD_test_three",
        five: "PROD_test_five",
      },
    });

    expect(resolveWaffoRuntimeConfig({ ...runtimeEnv, WAFFO_ENVIRONMENT: "prod" }).productIds).toEqual({
      one: "PROD_prod_one",
      three: "PROD_prod_three",
      five: "PROD_prod_five",
    });
    expect(() => resolveWaffoRuntimeConfig({
      ...runtimeEnv,
      WAFFO_PROD_PRODUCT_ID_ONE: "PROD_test_one",
    })).toThrow("WAFFO_CONFIGURATION_UNAVAILABLE");
    expect(() => resolveWaffoRuntimeConfig({
      ...runtimeEnv,
      WAFFO_PROD_PRODUCT_ID_THREE: "PROD_test_one",
    })).toThrow("WAFFO_CONFIGURATION_UNAVAILABLE");
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
    });

    const result = await adapter.createCheckout({
      orderId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "three",
    });

    expect(result).toEqual({
      sessionId: "cs_test",
      checkoutUrl: "https://pancake.waffo.ai/store/test/checkout/cs_test#token=secret-token",
      expiresAt: new Date("2026-08-24T02:00:00.000Z"),
    });
    expect(create).toHaveBeenCalledWith({
      productId: "PROD_test_three",
      currency: CURRENCY,
      buyerIdentity: "user-123",
      buyerEmail: "buyer@example.com",
      orderMerchantExternalId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
      metadata: {
        internalOrderId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
        productKey: "three",
        providerProductId: "PROD_test_three",
      },
    });
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty("successUrl");
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty("priceSnapshot");
    expect(JSON.stringify(result)).not.toContain("tokenExpiresAt");
  });

  it("rejects a provider checkout URL that is not HTTPS", async () => {
    const adapter = createWaffoPaymentAdapter(resolveWaffoRuntimeConfig(runtimeEnv), {
      checkout: {
        authenticated: {
          create: vi.fn(async () => ({
            sessionId: "cs_test",
            checkoutUrl: "javascript:alert(1)",
            expiresAt: "2026-08-24T02:00:00.000Z",
            token: "secret-token",
            tokenExpiresAt: "2026-08-24T01:20:00.000Z",
          })),
        },
      },
    });

    await expect(adapter.createCheckout({
      orderId: "8b6d8846-cdce-4dde-9744-817b8329a5b6",
      userId: "user-123",
      buyerEmail: "buyer@example.com",
      productKey: "one",
    })).rejects.toThrow("WAFFO_PROVIDER_RESPONSE_INVALID");
  });
});
