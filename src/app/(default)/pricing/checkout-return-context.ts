export const CHECKOUT_RETURN_CONTEXT_KEY = "quickiching:commercial:checkout-return:v1";

export type CheckoutReturnContext = {
  returnUrl?: string;
  creditsBeforeCheckout: number;
  orderId: string;
  createdAt: number;
  expiresAt: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isSafeReturnUrl(value: unknown): value is string | undefined {
  return value === undefined || (
    typeof value === "string"
    && value.startsWith("/")
    && !value.startsWith("//")
  );
}

export function buildCheckoutReturnContext(input: {
  returnUrl?: string;
  creditsBeforeCheckout: number;
  orderId: string;
  createdAt: number;
  expiresAt: number;
}): CheckoutReturnContext {
  return {
    ...(isSafeReturnUrl(input.returnUrl) && input.returnUrl ? { returnUrl: input.returnUrl } : {}),
    creditsBeforeCheckout: input.creditsBeforeCheckout,
    orderId: input.orderId,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
  };
}

function isContext(value: unknown): value is CheckoutReturnContext {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return isSafeReturnUrl(candidate.returnUrl)
    && typeof candidate.creditsBeforeCheckout === "number"
    && Number.isInteger(candidate.creditsBeforeCheckout)
    && candidate.creditsBeforeCheckout >= 0
    && typeof candidate.orderId === "string"
    && candidate.orderId.length > 0
    && typeof candidate.createdAt === "number"
    && Number.isFinite(candidate.createdAt)
    && typeof candidate.expiresAt === "number"
    && Number.isFinite(candidate.expiresAt);
}

export function isCheckoutReturnContextFresh(
  context: CheckoutReturnContext,
  nowMs: number = Date.now(),
): boolean {
  return Number.isFinite(nowMs)
    && Number.isFinite(context.expiresAt)
    && nowMs <= context.expiresAt;
}

export function writeCheckoutReturnContext(storage: StorageLike, context: CheckoutReturnContext): void {
  storage.setItem(CHECKOUT_RETURN_CONTEXT_KEY, JSON.stringify(context));
}

export function readCheckoutReturnContext(
  storage: StorageLike,
  nowMs: number = Date.now(),
): CheckoutReturnContext | null {
  const raw = storage.getItem(CHECKOUT_RETURN_CONTEXT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isContext(parsed) || !isCheckoutReturnContextFresh(parsed, nowMs)) {
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
