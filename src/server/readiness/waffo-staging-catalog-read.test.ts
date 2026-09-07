import { describe, expect, it, vi } from "vitest";
import { collectWaffoTestCatalogDiagnostics } from "./waffo-staging-catalog-read";

const baseEnv = {
  NODE_ENV: "production",
  APP_ENV: "staging",
  WAFFO_ENVIRONMENT: "test",
  WAFFO_MERCHANT_ID: "MER_test",
  WAFFO_PRIVATE_KEY: "private-key-never-returned",
  WAFFO_STORE_ID: "STO_test",
  WAFFO_TEST_PRODUCT_ID_ONE: "PROD_one",
  WAFFO_TEST_PRODUCT_ID_THREE: "PROD_three",
  WAFFO_TEST_PRODUCT_ID_FIVE: "PROD_five",
};

function product(id: string, amount: string) {
  return {
    id,
    status: "active",
    prices: [{ currency: "USD", priceInfo: { amount } }],
  };
}

function fakeClient(input: {
  storeStatus?: string;
  amountThree?: string;
  graphqlErrors?: boolean;
} = {}) {
  const query = vi.fn(async ({ query: text, variables }: { query: string; variables?: Record<string, unknown> }) => {
    if (input.graphqlErrors) return { data: null, errors: [{ message: "provider failure" }] };
    if (text.includes("onetimeProducts")) {
      return {
        data: {
          store: { id: "STO_test", status: input.storeStatus ?? "active" },
          onetimeProducts: [
            product("PROD_one", "2.99"),
            product("PROD_three", input.amountThree ?? "6.99"),
            product("PROD_five", "9.99"),
          ],
        },
      };
    }
    if (text.includes("onetimeProductVersions")) {
      const productId = variables?.productId;
      return {
        data: {
          onetimeProductVersions: [{
            isTestVersion: productId === "PROD_one" || productId === "PROD_three" || productId === "PROD_five",
            isProdVersion: false,
          }],
        },
      };
    }
    throw new Error(`unexpected query: ${text}`);
  });
  return { client: { graphql: { query } }, query };
}

describe("staging runtime authenticated Waffo Test catalog read", () => {
  it("returns only sanitized authoritative one-time 1/3/5 mapping facts", async () => {
    const fake = fakeClient();

    const result = await collectWaffoTestCatalogDiagnostics(baseEnv, fake.client as never);

    expect(result).toEqual({
      ok: true,
      environment: "test",
      model: "one_time",
      store: { id: "STO_test", status: "active" },
      packs: [
        { pack: 1, productId: "PROD_one", amountMinor: 299, currency: "USD", status: "active", hasTestVersion: true },
        { pack: 3, productId: "PROD_three", amountMinor: 699, currency: "USD", status: "active", hasTestVersion: true },
        { pack: 5, productId: "PROD_five", amountMinor: 999, currency: "USD", status: "active", hasTestVersion: true },
      ],
    });
    expect(JSON.stringify(result)).not.toContain(baseEnv.WAFFO_PRIVATE_KEY);
    expect(fake.query).toHaveBeenCalledTimes(4);
  });

  it("fails closed on provider/catalog mismatches without leaking provider error text", async () => {
    const wrongPrice = await collectWaffoTestCatalogDiagnostics(baseEnv, fakeClient({ amountThree: "7.00" }).client as never);
    expect(wrongPrice).toEqual({ ok: false, environment: "test", reason: "PRODUCT_PRICE_MISMATCH:3" });

    const providerError = await collectWaffoTestCatalogDiagnostics(baseEnv, fakeClient({ graphqlErrors: true }).client as never);
    expect(providerError).toEqual({ ok: false, environment: "test", reason: "WAFFO_GRAPHQL_CONTRACT_ERROR" });
    expect(JSON.stringify(providerError)).not.toContain("provider failure");
  });

  it("refuses any non-test Waffo environment before provider reads", async () => {
    const fake = fakeClient();
    const result = await collectWaffoTestCatalogDiagnostics({
      ...baseEnv,
      APP_ENV: "production",
      WAFFO_ENVIRONMENT: "prod",
      WAFFO_PROD_PRODUCT_ID_ONE: "PROD_prod_one",
      WAFFO_PROD_PRODUCT_ID_THREE: "PROD_prod_three",
      WAFFO_PROD_PRODUCT_ID_FIVE: "PROD_prod_five",
    }, fake.client as never);

    expect(result).toEqual({ ok: false, environment: "prod", reason: "WAFFO_TEST_ENVIRONMENT_REQUIRED" });
    expect(fake.query).not.toHaveBeenCalled();
  });
});