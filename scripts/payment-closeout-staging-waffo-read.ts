import { WaffoPancake } from "@waffo/pancake-ts";
import { validateWaffoTestCatalog } from "../src/server/payments/waffo-product-readiness";

const PROJECT_ID = "prj_iKtw9xKmIlEfe44gEocgLr2QDLfE";
const TEAM_ID = "team_z1b9TTQtbNkr43dzs5JVJPnQ";
const REQUIRED = [
  "APP_ENV",
  "WAFFO_ENVIRONMENT",
  "WAFFO_MERCHANT_ID",
  "WAFFO_PRIVATE_KEY",
  "WAFFO_STORE_ID",
  "WAFFO_TEST_PRODUCT_ID_ONE",
  "WAFFO_TEST_PRODUCT_ID_THREE",
  "WAFFO_TEST_PRODUCT_ID_FIVE",
] as const;

type EnvEntry = { id?: unknown; key?: unknown; target?: unknown; value?: unknown };
type EnvKey = typeof REQUIRED[number];

type GraphqlResponse<T> = { data?: T; errors?: Array<{ message?: string }>; warnings?: unknown[] };

function targetsProduction(value: unknown): boolean {
  return value === "production" || (Array.isArray(value) && value.includes("production"));
}

async function vercelJson(url: URL, token: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`VERCEL_READ_FAILED:${response.status}`);
  return response.json();
}

async function readStagingEnv(token: string): Promise<Record<EnvKey, string>> {
  const listUrl = new URL(`https://api.vercel.com/v10/projects/${PROJECT_ID}/env`);
  listUrl.searchParams.set("teamId", TEAM_ID);
  const list = await vercelJson(listUrl, token) as { envs?: EnvEntry[] };
  if (!Array.isArray(list.envs)) throw new Error("VERCEL_ENV_LIST_INVALID");

  const result = {} as Record<EnvKey, string>;
  for (const key of REQUIRED) {
    const matches = list.envs.filter((entry) => entry.key === key && targetsProduction(entry.target));
    if (matches.length !== 1) throw new Error(`STAGING_ENV_CARDINALITY:${key}`);
    const entry = matches[0];
    let value = typeof entry.value === "string" ? entry.value : "";
    if (!value.trim()) {
      if (typeof entry.id !== "string" || !entry.id) throw new Error(`STAGING_ENV_ID_MISSING:${key}`);
      const valueUrl = new URL(`https://api.vercel.com/v1/projects/${PROJECT_ID}/env/${entry.id}`);
      valueUrl.searchParams.set("teamId", TEAM_ID);
      const resolved = await vercelJson(valueUrl, token) as { value?: unknown };
      value = typeof resolved.value === "string" ? resolved.value : "";
    }
    if (!value.trim()) throw new Error(`STAGING_ENV_VALUE_UNAVAILABLE:${key}`);
    result[key] = value;
  }
  return result;
}

function amountString(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(2);
  throw new Error("WAFFO_PRICE_AMOUNT_INVALID");
}

async function main(): Promise<void> {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) throw new Error("VERCEL_TOKEN_UNAVAILABLE");
  const env = await readStagingEnv(token);
  if (env.APP_ENV !== "staging") throw new Error("STAGING_APP_ENV_INVALID");
  if (env.WAFFO_ENVIRONMENT !== "test") throw new Error("STAGING_WAFFO_ENV_INVALID");

  const client = new WaffoPancake({
    merchantId: env.WAFFO_MERCHANT_ID,
    privateKey: env.WAFFO_PRIVATE_KEY,
    environment: "test",
  });

  async function query<T>(queryText: string, variables: Record<string, unknown>): Promise<T> {
    const response = await client.graphql.query<T>({ query: queryText, variables }) as GraphqlResponse<T>;
    if (response.errors?.length || response.warnings?.length || response.data === undefined) {
      throw new Error("WAFFO_GRAPHQL_CONTRACT_ERROR");
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
  }`, { storeId: env.WAFFO_STORE_ID });

  if (!catalog.store || !Array.isArray(catalog.onetimeProducts)) {
    throw new Error("WAFFO_CATALOG_SHAPE_INVALID");
  }

  const configured = [
    { pack: 1 as const, productId: env.WAFFO_TEST_PRODUCT_ID_ONE, expectedAmountMinor: 299 },
    { pack: 3 as const, productId: env.WAFFO_TEST_PRODUCT_ID_THREE, expectedAmountMinor: 699 },
    { pack: 5 as const, productId: env.WAFFO_TEST_PRODUCT_ID_FIVE, expectedAmountMinor: 999 },
  ];

  const testVersionByProduct = new Map<string, boolean>();
  for (const product of configured) {
    const versions = await query<{
      onetimeProductVersions?: Array<{ isTestVersion?: boolean; isProdVersion?: boolean }>;
    }>(`query ($productId: String!) {
      onetimeProductVersions(productId: $productId) { isTestVersion isProdVersion }
    }`, { productId: product.productId });
    if (!Array.isArray(versions.onetimeProductVersions)) {
      throw new Error(`WAFFO_PRODUCT_VERSION_SHAPE_INVALID:${product.pack}`);
    }
    testVersionByProduct.set(
      product.productId,
      versions.onetimeProductVersions.some((version) => version.isTestVersion === true),
    );
  }

  const result = validateWaffoTestCatalog(
    { storeId: env.WAFFO_STORE_ID, products: configured },
    {
      store: { id: catalog.store.id ?? "", status: catalog.store.status ?? "" },
      products: catalog.onetimeProducts.map((product) => ({
        id: product.id ?? "",
        status: product.status ?? "",
        prices: Array.isArray(product.prices)
          ? product.prices.map((price) => ({
              currency: price.currency ?? "",
              amount: amountString(price.priceInfo?.amount),
            }))
          : [],
        hasTestVersion: testVersionByProduct.get(product.id ?? "") === true,
      })),
    },
  );

  if (!result.ok) throw new Error(`WAFFO_TEST_CATALOG_NOT_READY:${result.reason}`);
  console.log(JSON.stringify({
    ok: true,
    environment: "test",
    store: "matched_active",
    model: "one_time",
    packs: result.packs,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "WAFFO_TEST_CATALOG_READ_FAILED");
  process.exitCode = 1;
});
