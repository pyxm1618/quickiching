import { describe, expect, it } from "vitest";
import { HEXAGRAM_SEO_REGISTRY } from "./seo";
import { DENSITY_REVIEW_RULINGS, densityReviewRulingFor } from "./density-rulings";

const EXPECTED_REVIEWED_EXCEPTIONS = new Map<string, "below-3%" | "above-5%">([
  ...[1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 14, 18, 20, 21, 22, 23, 25, 26, 28, 29, 30, 32, 34, 36, 37, 40, 41, 44, 45, 46, 47, 48, 49, 50, 51, 52, 54, 56, 57, 58, 59, 60, 61, 62, 63, 64].map((number) => [`en:${number}`, "below-3%"] as const),
  ...[8, 13, 25, 36, 39, 54].map((number) => [`zh-Hans:${number}`, "above-5%"] as const),
]);

describe("density review rulings", () => {
  it("stores one distinct editorial decision for each current out-of-band page", () => {
    expect(DENSITY_REVIEW_RULINGS).toHaveLength(EXPECTED_REVIEWED_EXCEPTIONS.size);

    const actual = new Map(DENSITY_REVIEW_RULINGS.map((ruling) => [`${ruling.locale}:${ruling.number}`, ruling.expectedBand]));
    expect(actual).toEqual(EXPECTED_REVIEWED_EXCEPTIONS);
    expect(new Set(DENSITY_REVIEW_RULINGS.map((ruling) => ruling.rationale)).size).toBe(DENSITY_REVIEW_RULINGS.length);
    expect(DENSITY_REVIEW_RULINGS.every((ruling) => ruling.rationale.length > 40)).toBe(true);
    expect(DENSITY_REVIEW_RULINGS.every((ruling) => ruling.reviewedBy === "content-review-v1")).toBe(true);
  });

  it("does not grant an exception to pages outside the reviewed exception ledger", () => {
    for (const entry of HEXAGRAM_SEO_REGISTRY) {
      const ruling = densityReviewRulingFor(entry.locale, entry.number);
      const key = `${entry.locale}:${entry.number}`;
      if (EXPECTED_REVIEWED_EXCEPTIONS.has(key)) {
        expect(ruling, key).toMatchObject({ expectedBand: EXPECTED_REVIEWED_EXCEPTIONS.get(key) });
      } else {
        expect(ruling, key).toBeNull();
      }
    }
  });
});
