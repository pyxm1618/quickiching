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
  status: "pending" | "checkout_initializing" | "checkout_created" | "paid" | "refunded" | "financial_review";
};

export type CheckoutRepository = {
  createOrGetOrder(input: Omit<CheckoutOrderRecord, "id" | "providerCheckoutSessionId" | "providerCheckoutUrl" | "checkoutExpiresAt" | "status">): Promise<{ order: CheckoutOrderRecord; created: boolean }>;
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

export class CheckoutServiceError extends Error {
  constructor(
    readonly code: "CHECKOUT_REQUEST_INVALID" | "CHECKOUT_IDEMPOTENCY_CONFLICT" | "CHECKOUT_UNAVAILABLE",
    readonly retryable: boolean,
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
        if (error instanceof Error && error.message === "PAYMENT_IDEMPOTENCY_CONFLICT") {
          throw new CheckoutServiceError("CHECKOUT_IDEMPOTENCY_CONFLICT", false);
        }
        throw new CheckoutServiceError("CHECKOUT_UNAVAILABLE", true);
      }

      const existing = orderResult.order;
      if (
        existing.providerCheckoutUrl &&
        existing.checkoutExpiresAt &&
        existing.checkoutExpiresAt.getTime() > (dependencies.now?.() ?? new Date()).getTime()
      ) {
        return {
          orderId: existing.id,
          checkoutUrl: existing.providerCheckoutUrl,
          expiresAt: existing.checkoutExpiresAt,
        };
      }
      if (!["pending", "checkout_created"].includes(existing.status)) {
        throw new CheckoutServiceError("CHECKOUT_IDEMPOTENCY_CONFLICT", false);
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
        const checkout = await dependencies.provider.createCheckout({
          orderId: existing.id,
          userId: input.userId,
          buyerEmail: input.buyerEmail,
          productKey: input.productKey,
        });
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
            // The original provider outcome remains unknown. The caller gets a
            // retryable safe error, while the database claim prevents a second call.
          }
        }
        throw new CheckoutServiceError("CHECKOUT_UNAVAILABLE", true);
      }
    },
  };
}
