import { describe, expect, it } from "vitest";
import {
  CHECKOUT_RETURN_CONTEXT_KEY,
  buildCheckoutReturnContext,
  isCheckoutReturnContextFresh,
  readCheckoutReturnContext,
  writeCheckoutReturnContext,
} from "./checkout-return-context";

class StorageStub {
  store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, value); }
  removeItem(key: string) { this.store.delete(key); }
}

describe("checkout return context", () => {
  it("preserves Reading return identity and authoritative expiry when checkout starts from a Reading", () => {
    expect(buildCheckoutReturnContext({
      returnUrl: "/readings/deep?session=cast-123",
      creditsBeforeCheckout: 0,
      orderId: "order-reading",
      createdAt: 123,
      expiresAt: 456,
    })).toEqual({
      returnUrl: "/readings/deep?session=cast-123",
      creditsBeforeCheckout: 0,
      orderId: "order-reading",
      createdAt: 123,
      expiresAt: 456,
    });
  });

  it("records direct Pricing checkout without inventing a Reading return", () => {
    expect(buildCheckoutReturnContext({
      creditsBeforeCheckout: 4,
      orderId: "order-direct",
      createdAt: 456,
      expiresAt: 789,
    })).toEqual({
      creditsBeforeCheckout: 4,
      orderId: "order-direct",
      createdAt: 456,
      expiresAt: 789,
    });
  });

  it("drops unsafe external return URLs while preserving reconciliation identity and expiry", () => {
    expect(buildCheckoutReturnContext({
      returnUrl: "//evil.example/steal",
      creditsBeforeCheckout: 2,
      orderId: "order-safe",
      createdAt: 789,
      expiresAt: 999,
    })).toEqual({
      creditsBeforeCheckout: 2,
      orderId: "order-safe",
      createdAt: 789,
      expiresAt: 999,
    });
  });

  it("round-trips a fresh direct checkout context through session storage", () => {
    const storage = new StorageStub();
    const now = 2_000_000;
    const direct = buildCheckoutReturnContext({
      creditsBeforeCheckout: 1,
      orderId: "direct",
      createdAt: now - 60_000,
      expiresAt: now + 60_000,
    });
    writeCheckoutReturnContext(storage as unknown as Storage, direct);
    expect(readCheckoutReturnContext(storage as unknown as Storage, now)).toEqual(direct);
    expect(storage.getItem(CHECKOUT_RETURN_CONTEXT_KEY)).not.toBeNull();
  });

  it("treats the exact provider expiry boundary as fresh", () => {
    const context = buildCheckoutReturnContext({
      creditsBeforeCheckout: 1,
      orderId: "boundary",
      createdAt: 1,
      expiresAt: 2_000_000,
    });
    expect(isCheckoutReturnContextFresh(context, 2_000_000)).toBe(true);
  });

  it("clears and ignores context after provider expiry", () => {
    const storage = new StorageStub();
    const now = 2_000_000;
    const stale = buildCheckoutReturnContext({
      creditsBeforeCheckout: 1,
      orderId: "stale-order",
      createdAt: now - 10_000,
      expiresAt: now - 1,
    });
    writeCheckoutReturnContext(storage as unknown as Storage, stale);

    expect(readCheckoutReturnContext(storage as unknown as Storage, now)).toBeNull();
    expect(storage.getItem(CHECKOUT_RETURN_CONTEXT_KEY)).toBeNull();
  });

  it("rejects and clears old persisted schema without expiresAt", () => {
    const storage = new StorageStub();
    storage.setItem(CHECKOUT_RETURN_CONTEXT_KEY, JSON.stringify({
      creditsBeforeCheckout: 1,
      orderId: "old-schema",
      createdAt: 1_900_000,
    }));

    expect(readCheckoutReturnContext(storage as unknown as Storage, 2_000_000)).toBeNull();
    expect(storage.getItem(CHECKOUT_RETURN_CONTEXT_KEY)).toBeNull();
  });

  it.each([
    ["string NaN", "not-a-timestamp"],
    ["numeric NaN", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
    ["null", null],
  ])("rejects and clears malformed expiresAt: %s", (_label, expiresAt) => {
    const storage = new StorageStub();
    storage.setItem(CHECKOUT_RETURN_CONTEXT_KEY, JSON.stringify({
      creditsBeforeCheckout: 1,
      orderId: "malformed-expiry",
      createdAt: 1_900_000,
      expiresAt,
    }));

    expect(readCheckoutReturnContext(storage as unknown as Storage, 2_000_000)).toBeNull();
    expect(storage.getItem(CHECKOUT_RETURN_CONTEXT_KEY)).toBeNull();
  });
});
