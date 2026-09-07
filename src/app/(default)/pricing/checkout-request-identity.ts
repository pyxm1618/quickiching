import type { ProductId } from "@/domain/entitlements/pricing";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type CreateId = () => string;

const keyFor = (productKey: ProductId) => `quickiching:checkout-request:${productKey}`;

export function checkoutFailurePresentation(status: number): {
  kind: "conflict" | "rate_limited" | "unavailable";
  message: string;
} {
  if (status === 409) {
    return {
      kind: "conflict",
      message: "This checkout is already being resolved. Your purchase identity was preserved; review or retry this same checkout instead of starting a new purchase.",
    };
  }
  if (status === 429) {
    return {
      kind: "rate_limited",
      message: "Too many checkout attempts. Please try again shortly.",
    };
  }
  return {
    kind: "unavailable",
    message: "Checkout is temporarily unavailable. Please try again.",
  };
}

export function createCheckoutRequestIdentityStore(storage: StorageLike, createId: CreateId = () => crypto.randomUUID()) {
  return {
    getOrCreate(productKey: ProductId): string {
      const key = keyFor(productKey);
      const existing = storage.getItem(key)?.trim();
      if (existing) return existing;
      const created = createId();
      storage.setItem(key, created);
      return created;
    },
    retain(_productKey: ProductId): void {
      // Deliberate no-op: uncertain/conflict/retryable outcomes retain the same
      // transaction identity in session storage for the next attempt or reload.
    },
    complete(productKey: ProductId): void {
      storage.removeItem(keyFor(productKey));
    },
  };
}
