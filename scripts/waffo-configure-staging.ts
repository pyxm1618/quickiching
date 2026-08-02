import {
  WaffoPancake,
  WaffoPancakeError,
  type UpdateOnetimeProductParams,
} from "@waffo/pancake-ts";
import {
  assertWaffoStagingSnapshot,
  resolveWaffoStagingConfig,
  waffoStagingProductUpdates,
  type WaffoStagingSnapshot,
} from "../src/server/release/waffo-staging-audit";

function safeFailure(error: unknown): string {
  if (error instanceof WaffoPancakeError) {
    if (error.status === 401 || error.status === 403) return "credentials_rejected";
    if (error.status >= 500) return "provider_unavailable";
    return "provider_configuration_rejected";
  }
  if (error instanceof Error && error.message.startsWith("WAFFO_STAGING_")) {
    return error.message.toLowerCase();
  }
  return "unknown";
}

try {
  const config = resolveWaffoStagingConfig();
  const client = new WaffoPancake({
    merchantId: config.merchantId,
    privateKey: config.privateKey,
  });

  for (const update of waffoStagingProductUpdates(config)) {
    // Waffo's current endpoint accepts taxIncluded, while SDK 0.16.1's
    // declaration omits that wire field. Preserve the explicit Test setting.
    await client.onetimeProducts.update(
      update as unknown as UpdateOnetimeProductParams,
    );
  }

  const storesResult = await client.graphql.query<{
    stores: Array<WaffoStagingSnapshot["stores"][number] & {
      storeWebhooks: NonNullable<WaffoStagingSnapshot["store"]>["storeWebhooks"];
    }>;
  }>({
    query: `query StagingWaffoStores {
      stores {
        id name status
        storeWebhooks { channel url events testMode }
      }
    }`,
  });
  if (!storesResult.data) throw new Error("WAFFO_STAGING_STORES_QUERY_INVALID");

  const productsResult = await client.graphql.query<{
    onetimeProducts: WaffoStagingSnapshot["onetimeProducts"];
  }>({
    query: `query StagingWaffoProducts($storeId: String!) {
      onetimeProducts(storeId: $storeId, filter: { status: { eq: "active" } }) {
        id name status hasProdVersion
        prices { currency priceInfo { amount taxCategory } }
      }
    }`,
    variables: { storeId: config.storeId },
  });
  if (!productsResult.data) throw new Error("WAFFO_STAGING_PRODUCTS_QUERY_INVALID");

  const auditedStore = storesResult.data.stores[0];
  if (!auditedStore) throw new Error("WAFFO_STAGING_STORE_INVALID");

  assertWaffoStagingSnapshot(
    {
      stores: storesResult.data.stores,
      onetimeProducts: productsResult.data.onetimeProducts,
      store: {
        id: auditedStore.id,
        storeWebhooks: auditedStore.storeWebhooks,
      },
    },
    config,
  );
  console.log(
    "Verified one Waffo Test store, three tax-excluded one-time products, no Production product versions, and the Test webhook",
  );
} catch (error) {
  console.error(`Waffo staging configuration failed: ${safeFailure(error)}`);
  process.exitCode = 1;
}
