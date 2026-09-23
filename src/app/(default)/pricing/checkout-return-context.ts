export const CHECKOUT_RETURN_CONTEXT_KEY = "quickiching:commercial:checkout-return:v1";

export type CheckoutReturnContext = {
  returnUrl: string;
  creditsBeforeCheckout: number;
  orderId: string;
  createdAt: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isContext(value: unknown): value is CheckoutReturnContext {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.returnUrl === "string"
    && candidate.returnUrl.startsWith("/")
    && !candidate.returnUrl.startsWith("//")
    && typeof candidate.creditsBeforeCheckout === "number"
    && Number.isInteger(candidate.creditsBeforeCheckout)
    && candidate.creditsBeforeCheckout >= 0
    && typeof candidate.orderId === "string"
    && candidate.orderId.length > 0
    && typeof candidate.createdAt === "number"
    && Number.isFinite(candidate.createdAt);
}

export function writeCheckoutReturnContext(
  storage: StorageLike,
  context: CheckoutReturnContext,
): void {
  storage.setItem(CHECKOUT_RETURN_CONTEXT_KEY, JSON.stringify(context));
}

export function readCheckoutReturnContext(storage: StorageLike): CheckoutReturnContext | null {
  const raw = storage.getItem(CHECKOUT_RETURN_CONTEXT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isContext(parsed)) {
      storage.removeItem(CHECKOUT_RETURN_CONTEXT_KEY);
      return null;
    }
    return parsed;
  } catch {
    storage.removeItem(CHECKOUT_RETURN_CONTEXT_KEY);
    return null;
  }
}

export function clearCheckoutReturnContext(storage: StorageLike): void {
  storage.removeItem(CHECKOUT_RETURN_CONTEXT_KEY);
}
