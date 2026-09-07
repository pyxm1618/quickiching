import { describe, expect, it } from "vitest";
import { auditPaymentCloseoutStagingEnv } from "./payment-closeout-env-audit";

describe("payment closeout staging env audit", () => {
  it("passes exact staging/test mapping while treating sensitive values as presence-only", () => {
    const result = auditPaymentCloseoutStagingEnv([
      { key: "APP_ENV", target: ["production"], value: "staging", type: "plain" },
      { key: "WAFFO_ENVIRONMENT", target: ["production"], value: "test", type: "plain" },
      { key: "DATABASE_URL", target: ["production"], type: "sensitive" },
      { key: "WAFFO_MERCHANT_ID", target: ["production"], type: "sensitive" },
      { key: "WAFFO_PRIVATE_KEY", target: ["production"], type: "sensitive" },
      { key: "WAFFO_STORE_ID", target: ["production"], type: "sensitive" },
      { key: "WAFFO_TEST_PRODUCT_ID_ONE", target: ["production"], type: "sensitive" },
      { key: "WAFFO_TEST_PRODUCT_ID_THREE", target: ["production"], type: "sensitive" },
      { key: "WAFFO_TEST_PRODUCT_ID_FIVE", target: ["production"], type: "sensitive" },
      { key: "PAYMENT_CHECKOUT_URL_KEYS", target: ["production"], type: "sensitive" },
      { key: "REFUND_OPERATOR_SECRET", target: ["production"], type: "sensitive" },
    ]);

    expect(result).toEqual({
      ok: true,
      appEnv: "staging",
      waffoEnvironment: "test",
      missingKeys: [],
      unreadableRequiredValues: [],
    });
  });

  it("reports missing keys and unreadable mapping values without exposing secret contents", () => {
    const result = auditPaymentCloseoutStagingEnv([
      { key: "APP_ENV", target: "production", type: "sensitive" },
      { key: "WAFFO_ENVIRONMENT", target: "production", type: "sensitive" },
      { key: "DATABASE_URL", target: "production", type: "sensitive" },
      { key: "WAFFO_MERCHANT_ID", target: "production", type: "sensitive" },
      { key: "WAFFO_PRIVATE_KEY", target: "production", type: "sensitive" },
      { key: "WAFFO_STORE_ID", target: "production", type: "sensitive" },
      { key: "WAFFO_TEST_PRODUCT_ID_ONE", target: "production", type: "sensitive" },
      { key: "WAFFO_TEST_PRODUCT_ID_THREE", target: "production", type: "sensitive" },
      { key: "WAFFO_TEST_PRODUCT_ID_FIVE", target: "production", type: "sensitive" },
      { key: "PAYMENT_CHECKOUT_URL_KEYS", target: "production", type: "sensitive" },
    ]);

    expect(result.ok).toBe(false);
    expect(result.missingKeys).toEqual(["REFUND_OPERATOR_SECRET"]);
    expect(result.unreadableRequiredValues).toEqual(["APP_ENV", "WAFFO_ENVIRONMENT"]);
    expect(JSON.stringify(result)).not.toContain("DATABASE_URL=");
  });

  it("fails closed on the wrong readable environment mapping", () => {
    const base = [
      "DATABASE_URL", "WAFFO_MERCHANT_ID", "WAFFO_PRIVATE_KEY", "WAFFO_STORE_ID",
      "WAFFO_TEST_PRODUCT_ID_ONE", "WAFFO_TEST_PRODUCT_ID_THREE", "WAFFO_TEST_PRODUCT_ID_FIVE",
      "PAYMENT_CHECKOUT_URL_KEYS", "REFUND_OPERATOR_SECRET",
    ].map((key) => ({ key, target: ["production"], type: "sensitive" }));
    const result = auditPaymentCloseoutStagingEnv([
      { key: "APP_ENV", target: ["production"], value: "production", type: "plain" },
      { key: "WAFFO_ENVIRONMENT", target: ["production"], value: "prod", type: "plain" },
      ...base,
    ]);
    expect(result.ok).toBe(false);
    expect(result.appEnv).toBe("invalid");
    expect(result.waffoEnvironment).toBe("invalid");
  });
});
