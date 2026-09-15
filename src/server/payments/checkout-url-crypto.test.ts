import { describe, expect, it } from "vitest";
import { encryptJsonWithKeyMaterial } from "../../lib/crypto";
import { decryptCheckoutUrl, encryptCheckoutUrl } from "./checkout-url-crypto";

function restore(name: "APP_SECRET" | "PAYMENT_CHECKOUT_URL_KEYS", value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe("checkout URL storage protection", () => {
  it("encrypts the bearer token with purpose-bound authenticated encryption", () => {
    const previousKeys = process.env.PAYMENT_CHECKOUT_URL_KEYS;
    process.env.PAYMENT_CHECKOUT_URL_KEYS = "v1:cp4-checkout-encryption-test-secret";
    try {
      const url = "https://pancake.waffo.ai/checkout/session#token=private-token";
      const stored = encryptCheckoutUrl(url, "order-1", process.env.PAYMENT_CHECKOUT_URL_KEYS!);

      expect(stored).toMatch(/^enc:v1:/);
      expect(stored).not.toContain(url);
      expect(stored).not.toContain("private-token");
      expect(decryptCheckoutUrl(stored, "order-1", process.env.PAYMENT_CHECKOUT_URL_KEYS!)).toBe(url);
      expect(decryptCheckoutUrl(stored, "order-2", process.env.PAYMENT_CHECKOUT_URL_KEYS!)).toBeNull();
    } finally {
      restore("PAYMENT_CHECKOUT_URL_KEYS", previousKeys);
    }
  });

  it("decrypts active URLs after rotating to a new current key", () => {
    const previousKeys = process.env.PAYMENT_CHECKOUT_URL_KEYS;
    try {
      process.env.PAYMENT_CHECKOUT_URL_KEYS = "v1:old-payment-checkout-key";
      const storedWithOldKey = encryptCheckoutUrl(
        "https://pancake.waffo.ai/checkout/old#token=old-token",
        "order-rotation",
        process.env.PAYMENT_CHECKOUT_URL_KEYS!,
      );

      process.env.PAYMENT_CHECKOUT_URL_KEYS = "v2:new-payment-checkout-key,v1:old-payment-checkout-key";
      expect(decryptCheckoutUrl(storedWithOldKey, "order-rotation", process.env.PAYMENT_CHECKOUT_URL_KEYS!))
        .toBe("https://pancake.waffo.ai/checkout/old#token=old-token");

      const storedWithCurrentKey = encryptCheckoutUrl(
        "https://pancake.waffo.ai/checkout/new#token=new-token",
        "order-current",
        process.env.PAYMENT_CHECKOUT_URL_KEYS!,
      );
      expect(storedWithCurrentKey).toContain('"v":"v2"');
    } finally {
      restore("PAYMENT_CHECKOUT_URL_KEYS", previousKeys);
    }
  });

  it("uses an explicitly injected keyring instead of global process state", () => {
    const previousKeys = process.env.PAYMENT_CHECKOUT_URL_KEYS;
    process.env.PAYMENT_CHECKOUT_URL_KEYS = "v1:wrong-global-key";
    try {
      const injectedKeys = "v1:capability-checked-custom-key";
      const stored = encryptCheckoutUrl(
        "https://pancake.waffo.ai/checkout/custom#token=custom-token",
        "order-custom-env",
        injectedKeys,
      );

      expect(decryptCheckoutUrl(stored, "order-custom-env", injectedKeys))
        .toBe("https://pancake.waffo.ai/checkout/custom#token=custom-token");
      expect(() => Reflect.apply(decryptCheckoutUrl, null, [stored, "order-custom-env"]))
        .not.toThrow();
      expect(Reflect.apply(decryptCheckoutUrl, null, [stored, "order-custom-env"])).toBeNull();
    } finally {
      restore("PAYMENT_CHECKOUT_URL_KEYS", previousKeys);
    }
  });

  it("reads legacy APP_SECRET-derived v1 ciphertext when that material is explicitly installed", () => {
    const previousKeys = process.env.PAYMENT_CHECKOUT_URL_KEYS;
    try {
      const orderId = "order-legacy-key-migration";
      const legacyUrl = "https://pancake.waffo.ai/checkout/legacy#token=legacy-token";
      const legacyBlob = encryptJsonWithKeyMaterial(
        { url: legacyUrl },
        "payment-checkout-url",
        "v1",
        "existing-app-secret-material",
        orderId,
      );
      const legacyCiphertext = `enc:v1:${JSON.stringify(legacyBlob)}`;

      process.env.PAYMENT_CHECKOUT_URL_KEYS = "v2:new-payment-key,v1:existing-app-secret-material";
      expect(decryptCheckoutUrl(legacyCiphertext, orderId, process.env.PAYMENT_CHECKOUT_URL_KEYS!)).toBe(legacyUrl);
    } finally {
      restore("PAYMENT_CHECKOUT_URL_KEYS", previousKeys);
    }
  });

  it("never falls back to the general application secret", () => {
    const previousKeys = process.env.PAYMENT_CHECKOUT_URL_KEYS;
    const previousSecret = process.env.APP_SECRET;
    delete process.env.PAYMENT_CHECKOUT_URL_KEYS;
    process.env.APP_SECRET = "general-app-secret-must-not-protect-payment-urls";
    try {
      expect(() => Reflect.apply(encryptCheckoutUrl, null, [
        "https://pancake.waffo.ai/checkout/session#token=private-token",
        "order-no-payment-key",
      ])).toThrow("PAYMENT_CHECKOUT_URL_KEYS_INVALID");
    } finally {
      restore("PAYMENT_CHECKOUT_URL_KEYS", previousKeys);
      restore("APP_SECRET", previousSecret);
    }
  });

  it("does not treat legacy plaintext checkout URLs as reusable secrets", () => {
    expect(decryptCheckoutUrl(
      "https://pancake.waffo.ai/checkout/session#token=legacy-token",
      "order-1",
      "v1:unused-payment-checkout-key",
    )).toBeNull();
  });
});
