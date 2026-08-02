type WaffoStagingEnvironment = Record<string, string | undefined>;

export const WAFFO_STAGING_WEBHOOK_EVENTS = [
  "order.completed",
  "refund.succeeded",
  "refund.failed",
] as const;

type ProductKey = "one" | "three" | "five";

export type WaffoStagingConfig = {
  merchantId: string;
  privateKey: string;
  storeId: string;
  webhookUrl: string;
  products: Array<{ key: ProductKey; id: string; amount: string }>;
};

export type WaffoStagingProductUpdate = {
  id: string;
  prices: {
    USD: {
      amount: string;
      taxIncluded: false;
      taxCategory: "saas";
    };
  };
};

export type WaffoStagingSnapshot = {
  stores: Array<{ id: string; name: string; status: string }>;
  onetimeProducts: Array<{
    id: string;
    name: string;
    status: string;
    hasProdVersion: boolean;
    prices: Array<{
      currency: string;
      priceInfo: { amount: string; taxCategory: string };
    }>;
  }>;
  store: {
    id: string;
    storeWebhooks: Array<{
      channel: string;
      url: string;
      events: string[];
      testMode: boolean;
    }>;
  } | null;
};

function required(env: WaffoStagingEnvironment, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`WAFFO_STAGING_CONFIG_MISSING:${name}`);
  return value;
}

export function resolveWaffoStagingConfig(
  env: WaffoStagingEnvironment = process.env,
): WaffoStagingConfig {
  if (
    env.QUICKICHING_DEPLOYMENT_TIER !== "staging"
    || env.APP_BASE_URL !== "https://staging.quickiching.com"
    || env.WAFFO_ENVIRONMENT !== "test"
  ) {
    throw new Error("WAFFO_STAGING_SCOPE_REJECTED");
  }

  return {
    merchantId: required(env, "WAFFO_MERCHANT_ID"),
    privateKey: required(env, "WAFFO_PRIVATE_KEY"),
    storeId: required(env, "WAFFO_STORE_ID"),
    webhookUrl: "https://staging.quickiching.com/api/webhooks/waffo",
    products: [
      { key: "one", id: required(env, "WAFFO_PRODUCT_ID_ONE"), amount: "2.99" },
      { key: "three", id: required(env, "WAFFO_PRODUCT_ID_THREE"), amount: "6.99" },
      { key: "five", id: required(env, "WAFFO_PRODUCT_ID_FIVE"), amount: "9.99" },
    ],
  };
}

export function waffoStagingProductUpdates(
  config: WaffoStagingConfig,
): WaffoStagingProductUpdate[] {
  return config.products.map((product) => ({
    id: product.id,
    prices: {
      USD: {
        amount: product.amount,
        taxIncluded: false,
        taxCategory: "saas",
      },
    },
  }));
}

function sameStrings(actual: string[], expected: readonly string[]): boolean {
  return actual.length === expected.length
    && [...actual].sort().join("\n") === [...expected].sort().join("\n");
}

export function assertWaffoStagingSnapshot(
  snapshot: WaffoStagingSnapshot,
  config: WaffoStagingConfig,
): void {
  const storeValid = snapshot.stores.length === 1
    && snapshot.stores[0]?.id === config.storeId
    && snapshot.stores[0]?.status === "active"
    && snapshot.store?.id === config.storeId;
  if (!storeValid) throw new Error("WAFFO_STAGING_STORE_INVALID");

  const expectedIds = new Set(config.products.map((product) => product.id));
  const productsValid = snapshot.onetimeProducts.length === config.products.length
    && snapshot.onetimeProducts.every((product) => {
      const expected = config.products.find((candidate) => candidate.id === product.id);
      const usd = product.prices.find((price) => price.currency === "USD");
      return expectedIds.has(product.id)
        && expected !== undefined
        && product.status === "active"
        && product.hasProdVersion === false
        && product.prices.length === 1
        && usd?.priceInfo.amount === expected.amount
        && usd.priceInfo.taxCategory === "saas";
    });
  if (!productsValid) throw new Error("WAFFO_STAGING_PRODUCTS_INVALID");

  const matchingWebhooks = snapshot.store?.storeWebhooks.filter(
    (webhook) => webhook.url === config.webhookUrl,
  ) ?? [];
  const webhook = matchingWebhooks[0];
  const webhookValid = matchingWebhooks.length === 1
    && webhook?.channel === "http"
    && webhook.testMode === true
    && sameStrings(webhook.events, WAFFO_STAGING_WEBHOOK_EVENTS);
  if (!webhookValid) throw new Error("WAFFO_STAGING_WEBHOOK_INVALID");
}
