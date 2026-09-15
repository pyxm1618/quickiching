import { WaffoPancake } from "@waffo/pancake-ts";
import { resolveWaffoRuntimeConfig } from "@/server/payments/waffo-adapter";
import { validateWaffoTestCatalog } from "@/server/payments/waffo-product-readiness";

type RuntimeEnv = Record<string, string | undefined>;
type Pack = 1 | 3 | 5;
type GraphqlResponse<T> = {
  data?: T | null;
  errors?: Array<{ message?: string }>;
  warnings?: unknown[];
};
type GraphqlClient = {
  graphql: {
    query<T>(input: { query: string; variables?: Record<string, unknown> }): Promise<GraphqlResponse<T>>;
  };
};

type ReadyPack = {
  pack: Pack;
  productId: string;
  amountMinor: number;
  currency: "USD";
  status: "active";
  hasTestVersion: true;
};

export type WaffoTestCatalogDiagnostics =
  | {
      ok: true;
      environment: "test";
      model: "one_time";
      store: { id: string; status: "active" };
      packs: ReadyPack[];
    }
  | {
      ok: false;
      environment: "test" | "prod" | null;
      reason: string;
    };

class CatalogReadError extends Error {}

function amountString(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(2);
  throw new CatalogReadError("WAFFO_PRICE_AMOUNT_INVALID");
}

function safeReason(error: unknown): string {
  if (error instanceof CatalogReadError) return error.message;
  if (error instanceof Error && error.message === "WAFFO_CONFIGURATION_UNAVAILABLE") {
    return "WAFFO_CONFIGURATION_UNAVAILABLE";
  }
  return "WAFFO_PROVIDER_READ_FAILED";
}

export async function collectWaffoTestCatalogDiagnostics(
  env: RuntimeEnv = process.env,
  injectedClient?: GraphqlClient,
): Promise<WaffoTestCatalogDiagnostics> {
  let environment: "test" | "prod" | null = null;
  try {
    const config = resolveWaffoRuntimeConfig(env);
    environment = config.environment;
    if (config.environment !== "test") {
      return { ok: false, environment, reason: "WAFFO_TEST_ENVIRONMENT_REQUIRED" };
    }

    const client: GraphqlClient = injectedClient ?? (new WaffoPancake({
      merchantId: config.merchantId,
      privateKey: config.privateKey,
      environment: "test",
    }) as unknown as GraphqlClient);

    async function query<T>(queryText: string, variables: Record<string, unknown>): Promise<T> {
      let response: GraphqlResponse<T>;
      try {
        response = await client.graphql.query<T>({ query: queryText, variables });
      } catch {
        throw new CatalogReadError("WAFFO_PROVIDER_READ_FAILED");
      }
      if (
        response.data == null
        || response.errors?.length
        || response.warnings?.length
      ) {
        throw new CatalogReadError("WAFFO_GRAPHQL_CONTRACT_ERROR");
      }
      return response.data;
    }

    const catalog = await query<{
      store?: { id?: string; status?: string } | null;
      onetimeProducts?: Array<{
        id?: string;
        status?: string;
        prices?: Array<{ currency?: string; priceInfo?: { amount?: unknown } }>;
      }>;
    }>(`query ($storeId: String!) {
      store(id: $storeId) { id status }
      onetimeProducts(storeId: $storeId) {
        id
        status
        prices { currency priceInfo { amount } }
      }
    }`, { storeId: config.storeId });

    if (!catalog.store || !Array.isArray(catalog.onetimeProducts)) {
      throw new CatalogReadError("WAFFO_CATALOG_SHAPE_INVALID");
    }

    const configured = [
      { pack: 1 as const, productId: config.productIds.one, expectedAmountMinor: 299 },
      { pack: 3 as const, productId: config.productIds.three, expectedAmountMinor: 699 },
      { pack: 5 as const, productId: config.productIds.five, expectedAmountMinor: 999 },
    ];

    const testVersionByProduct = new Map<string, boolean>();
    for (const product of configured) {
      const versions = await query<{
        onetimeProductVersions?: Array<{ isTestVersion?: boolean; isProdVersion?: boolean }>;
      }>(`query ($productId: String!) {
        onetimeProductVersions(productId: $productId) { isTestVersion isProdVersion }
      }`, { productId: product.productId });
      if (!Array.isArray(versions.onetimeProductVersions)) {
        throw new CatalogReadError("WAFFO_PRODUCT_VERSION_SHAPE_INVALID");
      }
      testVersionByProduct.set(
        product.productId,
        versions.onetimeProductVersions.some((version) => version.isTestVersion === true),
      );
    }

    const providerProducts = catalog.onetimeProducts.map((product) => ({
      id: product.id ?? "",
      status: product.status ?? "",
      prices: Array.isArray(product.prices)
        ? product.prices.map((price) => ({
            currency: price.currency ?? "",
            amount: amountString(price.priceInfo?.amount),
          }))
        : [],
      hasTestVersion: testVersionByProduct.get(product.id ?? "") === true,
    }));

    const readiness = validateWaffoTestCatalog(
      { storeId: config.storeId, products: configured },
      {
        store: { id: catalog.store.id ?? "", status: catalog.store.status ?? "" },
        products: providerProducts,
      },
    );
    if (!readiness.ok) return { ok: false, environment: "test", reason: readiness.reason };

    const byId = new Map(providerProducts.map((product) => [product.id, product]));
    const packs: ReadyPack[] = configured.map((expected) => {
      const product = byId.get(expected.productId);
      if (!product || product.status !== "active" || product.hasTestVersion !== true) {
        throw new CatalogReadError("WAFFO_CATALOG_SHAPE_INVALID");
      }
      return {
        pack: expected.pack,
        productId: expected.productId,
        amountMinor: expected.expectedAmountMinor,
        currency: "USD",
        status: "active",
        hasTestVersion: true,
      };
    });

    return {
      ok: true,
      environment: "test",
      model: "one_time",
      store: { id: config.storeId, status: "active" },
      packs,
    };
  } catch (error) {
    return { ok: false, environment, reason: safeReason(error) };
  }
}
