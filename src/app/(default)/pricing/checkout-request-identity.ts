import type { ProductId } from "@/domain/entitlements/pricing";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type CreateId = () => string;

const keyFor = (productKey: ProductId) => `quickiching:checkout-request:${productKey}`;

export function checkoutFailurePresentation(status: number, locale: "en" | "zh-Hans" = "en"): {
  kind: "conflict" | "rate_limited" | "unavailable";
  message: string;
} {
  const isZh = locale === "zh-Hans";
  if (status === 409) {
    return {
      kind: "conflict",
      message: isZh
        ? "当前支付正在处理中。本次交易已保留，请复核或继续当前支付，无需重复发起新购买。"
        : "This checkout is already being resolved. Your purchase identity was preserved; review or retry this same checkout instead of starting a new purchase.",
    };
  }
  if (status === 429) {
    return {
      kind: "rate_limited",
      message: isZh
        ? "尝试支付过于频繁，请稍候再试。"
        : "Too many checkout attempts. Please try again shortly.",
    };
  }
  return {
    kind: "unavailable",
    message: isZh
      ? "暂时无法发起支付，请重试。"
      : "Checkout is temporarily unavailable. Please try again.",
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
