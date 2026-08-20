import { describe, expect, it } from "vitest";
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  buildIndexNowPayload,
  defaultIndexNowUrls,
  normalizeIndexNowDeletedUrl,
  normalizeIndexNowLiveUrl,
  uniqueDeletedIndexNowUrls,
  uniqueLiveIndexNowUrls,
} from "./indexnow";
import { indexablePathInventory } from "@/i18n/routes";
import { INDEXABLE_PATHS, SITE_ORIGIN, absoluteUrl } from "./seo";

const THREE_COIN_RESULT_PATH = "/readings/three-coin/result";

describe("IndexNow Public V1 generation", () => {
  it("uses a stable key hosted on the canonical origin", () => {
    expect(INDEXNOW_KEY).toBe("0458fb9ef2ef723618b52f6861b3b2f7");
    expect(INDEXNOW_KEY_LOCATION).toBe(`${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`);
    expect(INDEXNOW_ENDPOINT).toBe("https://api.indexnow.org/indexnow");
  });

  it("defaults to only canonical indexable URLs", () => {
    const inventory = indexablePathInventory().map(absoluteUrl);
    expect(defaultIndexNowUrls()).toHaveLength(75);
    expect(defaultIndexNowUrls()).toEqual(inventory);
    expect(new Set(defaultIndexNowUrls())).toEqual(new Set(inventory));
    expect(defaultIndexNowUrls()).not.toContain(absoluteUrl(THREE_COIN_RESULT_PATH));
    expect(defaultIndexNowUrls()).toContain(absoluteUrl("/zh"));
    expect(defaultIndexNowUrls()).toContain(absoluteUrl("/zh/methods/mei-hua-yi-shu"));
  });

  it("normalizes live paths, strips fragments, and deduplicates", () => {
    expect(uniqueLiveIndexNowUrls(["/methods/three-coin#tool", `${SITE_ORIGIN}/methods/three-coin`])).toEqual([
      `${SITE_ORIGIN}/methods/three-coin`,
    ]);
    expect(normalizeIndexNowLiveUrl("/zh")).toBe(`${SITE_ORIGIN}/zh`);
    expect(normalizeIndexNowLiveUrl("/zh/methods/mei-hua-yi-shu")).toBe(`${SITE_ORIGIN}/zh/methods/mei-hua-yi-shu`);
  });

  it("rejects non-canonical hosts, query URLs, and non-indexable live paths", () => {
    expect(() => normalizeIndexNowLiveUrl("https://quickiching.com/")).toThrow("INDEXNOW_NON_CANONICAL_HOST");
    expect(() => normalizeIndexNowLiveUrl("https://ichingcoin.vercel.app/")).toThrow("INDEXNOW_NON_CANONICAL_HOST");
    expect(() => normalizeIndexNowLiveUrl("http://www.quickiching.com/")).toThrow("INDEXNOW_NON_CANONICAL_HOST");
    expect(() => normalizeIndexNowLiveUrl("/pricing")).toThrow("INDEXNOW_NON_INDEXABLE_PATH");
    expect(() => normalizeIndexNowLiveUrl("/three-coin-method")).toThrow("INDEXNOW_NON_INDEXABLE_PATH");
    expect(() => normalizeIndexNowLiveUrl("/account")).toThrow("INDEXNOW_NON_INDEXABLE_PATH");
    expect(() => normalizeIndexNowLiveUrl("/history")).toThrow("INDEXNOW_NON_INDEXABLE_PATH");
    expect(() => normalizeIndexNowLiveUrl(THREE_COIN_RESULT_PATH)).toThrow("INDEXNOW_NON_INDEXABLE_PATH");
    expect(() => normalizeIndexNowLiveUrl("/methods/three-coin?utm_source=test")).toThrow("INDEXNOW_QUERY_URL_FORBIDDEN");
  });

  it("allows canonical deleted URLs while retaining canonical-host and query safety", () => {
    expect(uniqueDeletedIndexNowUrls(["/old-removed-page#fragment", `${SITE_ORIGIN}/old-removed-page`])).toEqual([
      `${SITE_ORIGIN}/old-removed-page`,
    ]);
    expect(() => normalizeIndexNowDeletedUrl("https://quickiching.com/old-removed-page")).toThrow("INDEXNOW_NON_CANONICAL_HOST");
    expect(() => normalizeIndexNowDeletedUrl("https://ichingcoin.vercel.app/old-removed-page")).toThrow("INDEXNOW_NON_CANONICAL_HOST");
    expect(() => normalizeIndexNowDeletedUrl("/old-removed-page?source=legacy")).toThrow("INDEXNOW_QUERY_URL_FORBIDDEN");
  });

  it("builds the official bulk payload shape", () => {
    expect(buildIndexNowPayload(["/", "/methods/yarrow-stalks"])).toEqual({
      host: "www.quickiching.com",
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_LOCATION,
      urlList: [`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/methods/yarrow-stalks`],
    });
  });
});
