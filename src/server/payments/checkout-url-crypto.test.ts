import { describe, expect, it } from "vitest";
import { decryptCheckoutUrl, encryptCheckoutUrl } from "./checkout-url-crypto";

describe("checkout URL storage protection", () => {
  it("encrypts the bearer token with purpose-bound authenticated encryption", () => {
    const previousSecret = process.env.APP_SECRET;
    process.env.APP_SECRET = "cp4-checkout-encryption-test-secret";
    try {
      const url = "https://pancake.waffo.ai/checkout/session#token=private-token";
      const stored = encryptCheckoutUrl(url, "order-1");

      expect(stored).toMatch(/^enc:v1:/);
      expect(stored).not.toContain(url);
      expect(stored).not.toContain("private-token");
      expect(decryptCheckoutUrl(stored, "order-1")).toBe(url);
      expect(decryptCheckoutUrl(stored, "order-2")).toBeNull();
    } finally {
      if (previousSecret === undefined) delete process.env.APP_SECRET;
      else process.env.APP_SECRET = previousSecret;
    }
  });

  it("does not treat legacy plaintext checkout URLs as reusable secrets", () => {
    expect(decryptCheckoutUrl(
      "https://pancake.waffo.ai/checkout/session#token=legacy-token",
      "order-1",
    )).toBeNull();
  });
});
