import type { ProductId } from "@/domain/entitlements/pricing";
import {
  WaffoPancake,
  type AuthenticatedCheckoutParams,
  type AuthenticatedCheckoutResult,
  type Notice,
} from "@waffo/pancake-ts";

type RuntimeEnv = Record<string, string | undefined>;

export type WaffoRuntimeConfig = {
  environment: "test" | "prod";
  merchantId: string;
  privateKey: string;
  storeId: string;
  productIds: Record<ProductId, string>;
};

export type WaffoWebhookConfig = Pick<WaffoRuntimeConfig, "environment" | "storeId">;

function required(env: RuntimeEnv, name: string): string {
  const candidate = env[name]?.trim();
  if (!candidate) throw new Error("WAFFO_CONFIGURATION_UNAVAILABLE");
  return candidate;
}

export function resolveWaffoWebhookConfig(env: RuntimeEnv = process.env): WaffoWebhookConfig {
  const environment = required(env, "WAFFO_ENVIRONMENT");
  if (environment !== "test" && environment !== "prod") {
    throw new Error("WAFFO_CONFIGURATION_UNAVAILABLE");
  }
  return { environment, storeId: required(env, "WAFFO_STORE_ID") };
}

export function resolveWaffoRuntimeConfig(env: RuntimeEnv = process.env): WaffoRuntimeConfig {
  const { environment, storeId } = resolveWaffoWebhookConfig(env);
  const testProductIds: Record<ProductId, string> = {
    one: required(env, "WAFFO_TEST_PRODUCT_ID_ONE"),
    three: required(env, "WAFFO_TEST_PRODUCT_ID_THREE"),
    five: required(env, "WAFFO_TEST_PRODUCT_ID_FIVE"),
  };
  const prodProductIds: Record<ProductId, string> = {
    one: required(env, "WAFFO_PROD_PRODUCT_ID_ONE"),
    three: required(env, "WAFFO_PROD_PRODUCT_ID_THREE"),
    five: required(env, "WAFFO_PROD_PRODUCT_ID_FIVE"),
  };
  const testIds = new Set(Object.values(testProductIds));
  const prodIds = new Set(Object.values(prodProductIds));
  if (
    testIds.size !== 3
    || prodIds.size !== 3
    || Object.values(prodProductIds).some((productId) => testIds.has(productId))
  ) {
    throw new Error("WAFFO_CONFIGURATION_UNAVAILABLE");
  }
  return {
    environment,
    merchantId: required(env, "WAFFO_MERCHANT_ID"),
    privateKey: required(env, "WAFFO_PRIVATE_KEY"),
    storeId,
    productIds: environment === "test" ? testProductIds : prodProductIds,
  };
}

type CheckoutClient = {
  checkout: {
    authenticated: {
      create(params: AuthenticatedCheckoutParams): Promise<AuthenticatedCheckoutResult & { warnings?: Notice[] }>;
    };
  };
};

export function createWaffoPaymentAdapter(
  config: WaffoRuntimeConfig,
  client: CheckoutClient = new WaffoPancake({
    merchantId: config.merchantId,
    privateKey: config.privateKey,
    environment: config.environment,
  }),
  now: () => Date = () => new Date(),
): {
  createCheckout(input: {
    orderId: string;
    userId: string;
    buyerEmail: string;
    productKey: ProductId;
  }): Promise<{ sessionId: string; checkoutUrl: string; expiresAt: Date }>;
} {
  return {
    async createCheckout(input) {
      const productId = config.productIds[input.productKey];
      const result = await client.checkout.authenticated.create({
        productId,
        currency: "USD",
        buyerIdentity: input.userId,
        buyerEmail: input.buyerEmail,
        orderMerchantExternalId: input.orderId,
        metadata: {
          internalOrderId: input.orderId,
          productKey: input.productKey,
          providerProductId: productId,
        },
      });
      let checkoutUrl: URL;
      const sessionExpiresAt = new Date(result.expiresAt);
      const tokenExpiresAt = new Date(result.tokenExpiresAt);
      try {
        checkoutUrl = new URL(result.checkoutUrl);
      } catch {
        throw new Error("WAFFO_PROVIDER_RESPONSE_INVALID");
      }
      const nowMs = now().getTime();
      const sessionExpiryMs = sessionExpiresAt.getTime();
      const tokenExpiryMs = tokenExpiresAt.getTime();
      if (
        checkoutUrl.protocol !== "https:" ||
        checkoutUrl.hostname !== "pancake.waffo.ai" ||
        checkoutUrl.port !== "" ||
        checkoutUrl.username !== "" ||
        checkoutUrl.password !== "" ||
        !checkoutUrl.hash.startsWith("#token=") ||
        checkoutUrl.hash.length <= "#token=".length ||
        !result.sessionId.trim() ||
        !Number.isFinite(nowMs) ||
        !Number.isFinite(sessionExpiryMs) ||
        !Number.isFinite(tokenExpiryMs) ||
        sessionExpiryMs <= nowMs ||
        tokenExpiryMs <= nowMs
      ) {
        throw new Error("WAFFO_PROVIDER_RESPONSE_INVALID");
      }
      return {
        sessionId: result.sessionId,
        checkoutUrl: result.checkoutUrl,
        expiresAt: new Date(Math.min(sessionExpiryMs, tokenExpiryMs)),
      };
    },
  };
}
