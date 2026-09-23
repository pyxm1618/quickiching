type Pack = 1 | 3 | 5;

type ConfiguredCatalog = {
  storeId: string;
  products: Array<{
    pack: Pack;
    productId: string;
    expectedAmountMinor: number;
  }>;
};

type ProviderCatalog = {
  store: { id: string; status: string };
  products: Array<{
    id: string;
    status: string;
    prices: Array<{ currency: string; amount: string }>;
    hasTestVersion: boolean;
  }>;
};

type CatalogReadiness =
  | { ok: true; packs: Array<{ pack: Pack; amountMinor: number }> }
  | { ok: false; reason: string };

function parseUsdMinor(amount: string): number | null {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) return null;
  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function validateWaffoTestCatalog(
  configured: ConfiguredCatalog,
  provider: ProviderCatalog,
): CatalogReadiness {
  if (!configured.storeId || provider.store.id !== configured.storeId) {
    return { ok: false, reason: "STORE_MISMATCH" };
  }
  if (provider.store.status !== "active") {
    return { ok: false, reason: "STORE_NOT_ACTIVE" };
  }
  if (configured.products.length !== 3) {
    return { ok: false, reason: "CONFIGURED_PRODUCT_SET_INVALID" };
  }

  const ids = configured.products.map((product) => product.productId);
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
    return { ok: false, reason: "CONFIGURED_PRODUCT_IDS_NOT_UNIQUE" };
  }

  const packs: Array<{ pack: Pack; amountMinor: number }> = [];
  for (const expected of configured.products) {
    const matches = provider.products.filter((product) => product.id === expected.productId);
    if (matches.length === 0) return { ok: false, reason: `PRODUCT_NOT_FOUND:${expected.pack}` };
    if (matches.length !== 1) return { ok: false, reason: `PRODUCT_AMBIGUOUS:${expected.pack}` };
    const product = matches[0];
    if (product.status !== "active") return { ok: false, reason: `PRODUCT_NOT_ACTIVE:${expected.pack}` };
    if (!product.hasTestVersion) return { ok: false, reason: `PRODUCT_TEST_VERSION_MISSING:${expected.pack}` };

    const usdPrices = product.prices.filter((price) => price.currency === "USD");
    if (usdPrices.length !== 1) {
      return { ok: false, reason: `PRODUCT_USD_PRICE_AMBIGUOUS:${expected.pack}` };
    }
    const amountMinor = parseUsdMinor(usdPrices[0].amount);
    if (amountMinor !== expected.expectedAmountMinor) {
      return { ok: false, reason: `PRODUCT_PRICE_MISMATCH:${expected.pack}` };
    }
    packs.push({ pack: expected.pack, amountMinor });
  }

  packs.sort((left, right) => left.pack - right.pack);
  return { ok: true, packs };
}
