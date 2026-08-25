import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CURRENCY, getProduct, type ProductId } from "@/domain/entitlements/pricing";

export type CheckoutOrderRecord = {
  id: string;
  userId: string;
  productKey: ProductId;
  quantity: number;
  amountMinor: number;
  currency: "USD";
  requestId: string;
  providerEnvironment: "test" | "prod";
  providerProductId: string;
  providerCheckoutSessionId: string | null;
  providerCheckoutUrl: string | null;
  checkoutExpiresAt: Date | null;
  checkoutClaimExpiresAt: Date | null;
  checkoutErrorCode: string | null;
  status: "pending" | "checkout_initializing" | "checkout_created" | "paid" | "refunded" | "financial_review";
};

export type CheckoutRepository = {
  createOrGetOrder(input: Omit<CheckoutOrderRecord, "id" | "providerCheckoutSessionId" | "providerCheckoutUrl" | "checkoutExpiresAt" | "checkoutClaimExpiresAt" | "checkoutErrorCode" | "status">): Promise<{ order: CheckoutOrderRecord; created: boolean }>;
  claimCheckoutInitialization(input: {
    orderId: string;
    claimToken: string;
    leaseDurationMs: number;
  }): Promise<boolean>;
  saveCheckout(input: {
    orderId: string;
    claimToken: string;
    providerCheckoutSessionId: string;
    providerCheckoutUrl: string;
    checkoutExpiresAt: Date;
  }): Promise<CheckoutOrderRecord>;
  failCheckoutInitialization(input: { orderId: string; claimToken: string; errorCode: string }): Promise<void>;
};

export class CheckoutRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number, readonly reason: "attempts" | "intents") {
    super("PAYMENT_CHECKOUT_RATE_LIMITED");
    this.name = "CheckoutRateLimitError";
  }
}

export class CheckoutServiceError extends Error {
  constructor(
    readonly code:
      | "CHECKOUT_REQUEST_INVALID"
      | "CHECKOUT_IDEMPOTENCY_CONFLICT"
      | "CHECKOUT_RATE_LIMITED"
      | "CHECKOUT_TERMINAL_ORDER"
      | "CHECKOUT_IN_PROGRESS"
      | "CHECKOUT_EXPIRED"
      | "CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN"
      | "CHECKOUT_UNAVAILABLE",
    readonly retryable: boolean,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = "CheckoutServiceError";
  }
}

type CheckoutProvider = {
  createCheckout(input: {
    orderId: string;
    userId: string;
    buyerEmail: string;
    productKey: ProductId;
  }): Promise<{ sessionId: string; checkoutUrl: string; expiresAt: Date }>;
};

type CheckoutServiceDependencies = {
  repository: CheckoutRepository;
  provider: CheckoutProvider;
  environment: "test" | "prod";
  productIds: Record<ProductId, string>;
  now?: () => Date;
  providerTimeoutMs?: number;
};

const inputSchema = z.object({
  userId: z.string().trim().min(1).max(128),
  buyerEmail: z.string().trim().email().max(320),
  productKey: z.enum(["one", "three", "five"]),
  requestId: z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();

function productAmountMinor(productKey: ProductId): number {
  const product = getProduct(productKey);
  if (!product) throw new CheckoutServiceError("CHECKOUT_REQUEST_INVALID", false);
  return Math.round(product.unitPriceUsd * 100);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("CHECKOUT_PROVIDER_TIMEOUT")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function createCheckoutService(dependencies: CheckoutServiceDependencies): {
  create(input: { userId: string; buyerEmail: string; productKey: string; requestId: string }): Promise<{
    orderId: string;
    checkoutUrl: string;
    expiresAt: Date;
  }>;
} {
  return {
    async create(rawInput) {
      const parsed = inputSchema.safeParse(rawInput);
      if (!parsed.success) throw new CheckoutServiceError("CHECKOUT_REQUEST_INVALID", false);
      const input = parsed.data;
      const product = getProduct(input.productKey);
      if (!product) throw new CheckoutServiceError("CHECKOUT_REQUEST_INVALID", false);

      let orderResult: Awaited<ReturnType<CheckoutRepository["createOrGetOrder"]>>;
      try {
        orderResult = await dependencies.repository.createOrGetOrder({
          userId: input.userId,
          productKey: input.productKey,
          quantity: product.quantity,
          amountMinor: productAmountMinor(input.productKey),
          currency: CURRENCY,
          requestId: input.requestId,
          providerEnvironment: dependencies.environment,
          providerProductId: dependencies.productIds[input.productKey],
        });
      } catch (error) {
        if (error instanceof CheckoutRateLimitError) {
          throw new CheckoutServiceError("CHECKOUT_RATE_LIMITED", true, error.retryAfterSeconds);
        }
        if (error instanceof Error && error.message === "PAYMENT_CHECKOUT_INTENT_LIMITED") {
          throw new CheckoutServiceError("CHECKOUT_RATE_LIMITED", true, 60);
        }
        if (error instanceof Error && error.message === "PAYMENT_IDEMPOTENCY_CONFLICT") {
          throw new CheckoutServiceError("CHECKOUT_IDEMPOTENCY_CONFLICT", false);
        }
        throw new CheckoutServiceError("CHECKOUT_UNAVAILABLE", true);
      }

      const existing = orderResult.order;
      const nowMs = (dependencies.now?.() ?? new Date()).getTime();
      if (existing.status === "paid" || existing.status === "refunded") {
        throw new CheckoutServiceError("CHECKOUT_TERMINAL_ORDER", false);
      }
      if (existing.status === "financial_review") {
        if (existing.checkoutErrorCode === "CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN") {
          throw new CheckoutServiceError("CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN", false);
        }
        if (existing.checkoutErrorCode === "CHECKOUT_EXPIRED") {
          throw new CheckoutServiceError("CHECKOUT_EXPIRED", false);
        }
        throw new CheckoutServiceError("CHECKOUT_TERMINAL_ORDER", false);
      }
      if (existing.status === "checkout_created") {
        const expiryMs = existing.checkoutExpiresAt?.getTime() ?? Number.NaN;
        if (
          existing.providerCheckoutUrl &&
          Number.isFinite(expiryMs) &&
          expiryMs > nowMs
        ) {
          return {
            orderId: existing.id,
            checkoutUrl: existing.providerCheckoutUrl,
            expiresAt: existing.checkoutExpiresAt!,
          };
        }
        throw new CheckoutServiceError("CHECKOUT_EXPIRED", false);
      }
      if (existing.status === "checkout_initializing") {
        const claimExpiryMs = existing.checkoutClaimExpiresAt?.getTime() ?? Number.NaN;
        if (Number.isFinite(claimExpiryMs) && claimExpiryMs > nowMs) {
          throw new CheckoutServiceError("CHECKOUT_IN_PROGRESS", true);
        }
        throw new CheckoutServiceError("CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN", false);
      }
      if (existing.status !== "pending") {
        throw new CheckoutServiceError("CHECKOUT_TERMINAL_ORDER", false);
      }

      const claimToken = randomUUID();
      let claimed = false;
      try {
        claimed = await dependencies.repository.claimCheckoutInitialization({
          orderId: existing.id,
          claimToken,
          leaseDurationMs: 2 * 60 * 1000,
        });
        if (!claimed) throw new CheckoutServiceError("CHECKOUT_UNAVAILABLE", true);
        const timeoutMs = dependencies.providerTimeoutMs ?? 30_000;
        if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5 * 60 * 1000) {
          throw new Error("CHECKOUT_PROVIDER_TIMEOUT_CONFIGURATION_INVALID");
        }
        const checkout = await withTimeout(dependencies.provider.createCheckout({
          orderId: existing.id,
          userId: input.userId,
          buyerEmail: input.buyerEmail,
          productKey: input.productKey,
        }), timeoutMs);
        const saved = await dependencies.repository.saveCheckout({
          orderId: existing.id,
          claimToken,
          providerCheckoutSessionId: checkout.sessionId,
          providerCheckoutUrl: checkout.checkoutUrl,
          checkoutExpiresAt: checkout.expiresAt,
        });
        if (!saved.providerCheckoutUrl || !saved.checkoutExpiresAt) {
          throw new Error("PAYMENT_CHECKOUT_PERSISTENCE_FAILED");
        }
        return {
          orderId: saved.id,
          checkoutUrl: saved.providerCheckoutUrl,
          expiresAt: saved.checkoutExpiresAt,
        };
      } catch (error) {
        if (error instanceof CheckoutServiceError) throw error;
        if (claimed) {
          try {
            await dependencies.repository.failCheckoutInitialization({
              orderId: existing.id,
              claimToken,
              errorCode: "CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN",
            });
          } catch {
            // The provider outcome remains unknown even if the failure marker
            // could not be persisted. Never turn that into an automatic retry.
          }
          throw new CheckoutServiceError("CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN", false);
        }
        throw new CheckoutServiceError("CHECKOUT_UNAVAILABLE", true);
      }
    },
  };
}
