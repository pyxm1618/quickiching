import { describe, expect, it } from "vitest";
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  buildIndexNowPayload,
  defaultIndexNowUrls,
  normalizeIndexNowUrl,
  uniqueIndexNowUrls,
} from "./indexnow";
import { INDEXABLE_PATHS, SITE_ORIGIN, absoluteUrl } from "./seo";

describe("IndexNow Public V1 generation", () => {
  it("uses a stable key hosted on the canonical origin", () => {
    expect(INDEXNOW_KEY).toBe("0458fb9ef2ef723618b52f6861b3b2f7");
    expect(INDEXNOW_KEY_LOCATION).toBe(`${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`);
    expect(INDEXNOW_ENDPOINT).toBe("https://api.indexnow.org/indexnow");
  });

  it("defaults to only canonical indexable URLs", () => {
    expect(defaultIndexNowUrls()).toEqual(INDEXABLE_PATHS.map(absoluteUrl));
  });

  it("normalizes paths, strips fragments, and deduplicates", () => {
    expect(uniqueIndexNowUrls(["/methods/three-coin#tool", `${SITE_ORIGIN}/methods/three-coin`])).toEqual([
      `${SITE_ORIGIN}/methods/three-coin`,
    ]);
  });

  it("rejects bare-domain, staging, http, and private/commercial URLs", () => {
    expect(() => normalizeIndexNowUrl("https://quickiching.com/")).toThrow("INDEXNOW_NON_CANONICAL_HOST");
    expect(() => normalizeIndexNowUrl("https://ichingcoin.vercel.app/")).toThrow("INDEXNOW_NON_CANONICAL_HOST");
    expect(() => normalizeIndexNowUrl("http://www.quickiching.com/")).toThrow("INDEXNOW_NON_CANONICAL_HOST");
    expect(() => normalizeIndexNowUrl("/account")).toThrow("INDEXNOW_PRIVATE_PATH");
    expect(() => normalizeIndexNowUrl("/checkout/test")).toThrow("INDEXNOW_PRIVATE_PATH");
    expect(() => normalizeIndexNowUrl("/result/example")).toThrow("INDEXNOW_PRIVATE_PATH");
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
