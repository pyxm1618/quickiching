import type { ProductId } from "@/domain/entitlements/pricing";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type CreateId = () => string;

const keyFor = (productKey: ProductId) => `quickiching:checkout-request:${productKey}`;

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
