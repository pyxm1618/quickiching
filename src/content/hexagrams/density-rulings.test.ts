import { describe, expect, it } from "vitest";
import { HEXAGRAM_SEO_REGISTRY } from "./seo";
import { DENSITY_REVIEW_RULING_GROUPS, densityReviewRulingFor } from "./density-rulings";

describe("density review rulings", () => {
  it("has explicit grouped decisions with auditable membership", () => {
    expect(DENSITY_REVIEW_RULING_GROUPS.length).toBeGreaterThan(0);
    const members = new Set<string>();
    for (const group of DENSITY_REVIEW_RULING_GROUPS) {
      expect(group.id).not.toMatch(/approved family coverage|repeats the exact entity/iu);
      expect(group.rationale.length).toBeGreaterThan(40);
      expect(group.numbers.length).toBeGreaterThan(0);
      for (const number of group.numbers) {
        const key = `${group.locale}:${number}`;
        expect(members.has(key), `duplicate ruling membership: ${key}`).toBe(false);
        members.add(key);
        expect(densityReviewRulingFor(group.locale, number)).toMatchObject({ id: group.id });
      }
    }
  });

  it("covers every registry page so an out-of-band warning cannot be unreviewed", () => {
    const keys = new Set<string>();
    for (const entry of HEXAGRAM_SEO_REGISTRY) {
      const ruling = densityReviewRulingFor(entry.locale, entry.number);
      expect(ruling, `${entry.locale}:${entry.number}`).not.toBeNull();
      keys.add(`${entry.locale}:${entry.number}`);
    }
    expect(keys).toHaveLength(128);
  });
});
