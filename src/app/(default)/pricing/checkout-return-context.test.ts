import { describe, expect, it } from "vitest";
import {
  CHECKOUT_RETURN_CONTEXT_KEY,
  CHECKOUT_RETURN_CONTEXT_TTL_MS,
  buildCheckoutReturnContext,
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
  it("preserves Reading return identity when checkout starts from a Reading", () => {
    expect(buildCheckoutReturnContext({
      returnUrl: "/readings/deep?session=cast-123",
      creditsBeforeCheckout: 0,
      orderId: "order-reading",
      createdAt: 123,
    })).toEqual({
      returnUrl: "/readings/deep?session=cast-123",
      creditsBeforeCheckout: 0,
      orderId: "order-reading",
      createdAt: 123,
    });
  });

  it("records direct Pricing checkout without inventing a Reading return", () => {
    expect(buildCheckoutReturnContext({
      creditsBeforeCheckout: 4,
      orderId: "order-direct",
      createdAt: 456,
    })).toEqual({ creditsBeforeCheckout: 4, orderId: "order-direct", createdAt: 456 });
  });

  it("drops unsafe external return URLs while preserving reconciliation identity", () => {
    expect(buildCheckoutReturnContext({
      returnUrl: "//evil.example/steal",
      creditsBeforeCheckout: 2,
      orderId: "order-safe",
      createdAt: 789,
    })).toEqual({ creditsBeforeCheckout: 2, orderId: "order-safe", createdAt: 789 });
  });

  it("round-trips a fresh direct checkout context through session storage", () => {
    const storage = new StorageStub();
    const now = 2_000_000;
    const direct = buildCheckoutReturnContext({
      creditsBeforeCheckout: 1,
      orderId: "direct",
      createdAt: now - CHECKOUT_RETURN_CONTEXT_TTL_MS,
    });
    writeCheckoutReturnContext(storage as unknown as Storage, direct);
    expect(readCheckoutReturnContext(storage as unknown as Storage, now)).toEqual(direct);
    expect(storage.getItem(CHECKOUT_RETURN_CONTEXT_KEY)).not.toBeNull();
  });

  it("clears and ignores stale checkout return context", () => {
    const storage = new StorageStub();
    const now = 2_000_000;
    const stale = buildCheckoutReturnContext({
      creditsBeforeCheckout: 1,
      orderId: "stale-order",
      createdAt: now - CHECKOUT_RETURN_CONTEXT_TTL_MS - 1,
    });
    writeCheckoutReturnContext(storage as unknown as Storage, stale);

    expect(readCheckoutReturnContext(storage as unknown as Storage, now)).toBeNull();
    expect(storage.getItem(CHECKOUT_RETURN_CONTEXT_KEY)).toBeNull();
  });
});
