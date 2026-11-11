import { describe, expect, it, vi } from "vitest";
import { CHECKOUT_RETURN_CONTEXT_KEY } from "./checkout-return-context";
import { completeCheckoutNavigation } from "./purchase-button";

class StorageStub {
  store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, value); }
  removeItem(key: string) { this.store.delete(key); }
}

describe("PurchaseButton checkout response authority", () => {
  const now = Date.parse("2026-11-11T08:00:00.000Z");

  it("persists authoritative expiresAt and navigates only for a complete valid checkout response", () => {
    const storage = new StorageStub();
    const navigate = vi.fn();
    const beforeNavigate = vi.fn();

    const ok = completeCheckoutNavigation({
      body: {
        orderId: "ord-valid",
        checkoutUrl: "https://pancake.waffo.ai/checkout/session#token=abc",
        expiresAt: "2026-11-11T08:20:00.000Z",
      },
      storage: storage as unknown as Storage,
      returnUrl: "/readings/deep?session=cast-123",
      creditsBeforeCheckout: 2,
      nowMs: now,
      beforeNavigate,
      navigate,
    });

    expect(ok).toBe(true);
    expect(beforeNavigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("https://pancake.waffo.ai/checkout/session#token=abc");
    expect(JSON.parse(storage.getItem(CHECKOUT_RETURN_CONTEXT_KEY)!)).toEqual({
      returnUrl: "/readings/deep?session=cast-123",
      creditsBeforeCheckout: 2,
      orderId: "ord-valid",
      createdAt: now,
      expiresAt: Date.parse("2026-11-11T08:20:00.000Z"),
    });
  });

  it.each([
    ["missing", undefined],
    ["invalid", "not-a-date"],
    ["already expired", "2026-11-11T07:59:59.999Z"],
    ["exactly now", "2026-11-11T08:00:00.000Z"],
  ])("refuses %s expiresAt without context write or checkout navigation", (_label, expiresAt) => {
    const storage = new StorageStub();
    const navigate = vi.fn();
    const beforeNavigate = vi.fn();

    const ok = completeCheckoutNavigation({
      body: {
        orderId: "ord-invalid-expiry",
        checkoutUrl: "https://pancake.waffo.ai/checkout/session#token=abc",
        expiresAt,
      },
      storage: storage as unknown as Storage,
      creditsBeforeCheckout: 0,
      nowMs: now,
      beforeNavigate,
      navigate,
    });

    expect(ok).toBe(false);
    expect(storage.getItem(CHECKOUT_RETURN_CONTEXT_KEY)).toBeNull();
    expect(beforeNavigate).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
