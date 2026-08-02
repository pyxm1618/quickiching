import { describe, expect, it } from "vitest";
import {
  assertWaffoStagingSnapshot,
  resolveWaffoStagingConfig,
  waffoStagingProductUpdates,
} from "./waffo-staging-audit";

const env = {
  QUICKICHING_DEPLOYMENT_TIER: "staging",
  APP_BASE_URL: "https://staging.quickiching.com",
  WAFFO_ENVIRONMENT: "test",
  WAFFO_MERCHANT_ID: "MER_test",
  WAFFO_PRIVATE_KEY: "test-private-key",
  WAFFO_STORE_ID: "STO_test",
  WAFFO_PRODUCT_ID_ONE: "PROD_one",
  WAFFO_PRODUCT_ID_THREE: "PROD_three",
  WAFFO_PRODUCT_ID_FIVE: "PROD_five",
};

describe("Waffo staging audit", () => {
  it("builds explicit tax-excluded Test product updates", () => {
    const config = resolveWaffoStagingConfig(env);
    expect(waffoStagingProductUpdates(config)).toEqual([
      {
        id: "PROD_one",
        prices: {
          USD: { amount: "2.99", taxIncluded: false, taxCategory: "saas" },
        },
      },
      {
        id: "PROD_three",
        prices: {
          USD: { amount: "6.99", taxIncluded: false, taxCategory: "saas" },
        },
      },
      {
        id: "PROD_five",
        prices: {
          USD: { amount: "9.99", taxIncluded: false, taxCategory: "saas" },
        },
      },
    ]);
  });

  it("accepts one Test store, three unpublished one-time products, and the required webhook", () => {
    const config = resolveWaffoStagingConfig(env);
    expect(() =>
      assertWaffoStagingSnapshot(
        {
          stores: [{ id: "STO_test", name: "quickiching", status: "active" }],
          onetimeProducts: [
            {
              id: "PROD_one",
              name: "1 Deep Reading Credit",
              status: "active",
              hasProdVersion: false,
              prices: [{ currency: "USD", priceInfo: { amount: "2.99", taxCategory: "saas" } }],
            },
            {
              id: "PROD_three",
              name: "3 Deep Reading Credits",
              status: "active",
              hasProdVersion: false,
              prices: [{ currency: "USD", priceInfo: { amount: "6.99", taxCategory: "saas" } }],
            },
            {
              id: "PROD_five",
              name: "5 Deep Reading Credits",
              status: "active",
              hasProdVersion: false,
              prices: [{ currency: "USD", priceInfo: { amount: "9.99", taxCategory: "saas" } }],
            },
          ],
          store: {
            id: "STO_test",
            storeWebhooks: [
              {
                channel: "http",
                url: "https://staging.quickiching.com/api/webhooks/waffo",
                events: ["order.completed", "refund.succeeded", "refund.failed"],
                testMode: true,
              },
            ],
          },
        },
        config,
      ),
    ).not.toThrow();
  });

  it("rejects Production publication or a non-Test deployment", () => {
    expect(() => resolveWaffoStagingConfig({ ...env, WAFFO_ENVIRONMENT: "prod" })).toThrow(
      "WAFFO_STAGING_SCOPE_REJECTED",
    );

    const config = resolveWaffoStagingConfig(env);
    expect(() =>
      assertWaffoStagingSnapshot(
        {
          stores: [{ id: "STO_test", name: "quickiching", status: "active" }],
          onetimeProducts: [
            {
              id: "PROD_one",
              name: "one",
              status: "active",
              hasProdVersion: true,
              prices: [{ currency: "USD", priceInfo: { amount: "2.99", taxCategory: "saas" } }],
            },
          ],
          store: { id: "STO_test", storeWebhooks: [] },
        },
        config,
      ),
    ).toThrow("WAFFO_STAGING_PRODUCTS_INVALID");
  });
});
