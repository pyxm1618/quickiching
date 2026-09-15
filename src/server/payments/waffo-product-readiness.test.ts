import { describe, expect, it } from "vitest";
import { validateWaffoTestCatalog } from "./waffo-product-readiness";

const configured = {
  storeId: "store-test",
  products: [
    { pack: 1 as const, productId: "prod-one", expectedAmountMinor: 299 },
    { pack: 3 as const, productId: "prod-three", expectedAmountMinor: 699 },
    { pack: 5 as const, productId: "prod-five", expectedAmountMinor: 999 },
  ],
};

const provider = {
  store: { id: "store-test", status: "active" },
  products: [
    { id: "prod-one", status: "active", prices: [{ currency: "USD", amount: "2.99" }], hasTestVersion: true },
    { id: "prod-three", status: "active", prices: [{ currency: "USD", amount: "6.99" }], hasTestVersion: true },
    { id: "prod-five", status: "active", prices: [{ currency: "USD", amount: "9.99" }], hasTestVersion: true },
  ],
};

describe("Waffo Test one-time catalog readiness", () => {
  it("accepts the exact active 1/3/5 Test catalog", () => {
    expect(validateWaffoTestCatalog(configured, provider)).toEqual({
      ok: true,
      packs: [
        { pack: 1, amountMinor: 299 },
        { pack: 3, amountMinor: 699 },
        { pack: 5, amountMinor: 999 },
      ],
    });
  });

  it("fails closed when configured product IDs are not unique", () => {
    const result = validateWaffoTestCatalog(
      { ...configured, products: [configured.products[0], { ...configured.products[1], productId: "prod-one" }, configured.products[2]] },
      provider,
    );
    expect(result).toEqual({ ok: false, reason: "CONFIGURED_PRODUCT_IDS_NOT_UNIQUE" });
  });

  it("fails closed for wrong store, inactive product, wrong USD price, or missing Test version", () => {
    expect(validateWaffoTestCatalog(configured, { ...provider, store: { id: "other", status: "active" } })).toEqual({ ok: false, reason: "STORE_MISMATCH" });
    expect(validateWaffoTestCatalog(configured, { ...provider, products: provider.products.map((p) => p.id === "prod-one" ? { ...p, status: "archived" } : p) })).toEqual({ ok: false, reason: "PRODUCT_NOT_ACTIVE:1" });
    expect(validateWaffoTestCatalog(configured, { ...provider, products: provider.products.map((p) => p.id === "prod-three" ? { ...p, prices: [{ currency: "USD", amount: "7.00" }] } : p) })).toEqual({ ok: false, reason: "PRODUCT_PRICE_MISMATCH:3" });
    expect(validateWaffoTestCatalog(configured, { ...provider, products: provider.products.map((p) => p.id === "prod-five" ? { ...p, hasTestVersion: false } : p) })).toEqual({ ok: false, reason: "PRODUCT_TEST_VERSION_MISSING:5" });
  });

  it("fails closed when a product is absent or has an ambiguous USD price", () => {
    expect(validateWaffoTestCatalog(configured, { ...provider, products: provider.products.filter((p) => p.id !== "prod-five") })).toEqual({ ok: false, reason: "PRODUCT_NOT_FOUND:5" });
    expect(validateWaffoTestCatalog(configured, { ...provider, products: provider.products.map((p) => p.id === "prod-one" ? { ...p, prices: [{ currency: "USD", amount: "2.99" }, { currency: "USD", amount: "2.99" }] } : p) })).toEqual({ ok: false, reason: "PRODUCT_USD_PRICE_AMBIGUOUS:1" });
  });
});
