import { describe, expect, it } from "vitest";
import { ZH_INDEXABLE_PAGE_SEO } from "./zh-pages";

describe("Simplified Chinese non-hexagram SEO registry", () => {
  const entries = Object.values(ZH_INDEXABLE_PAGE_SEO);

  it("contains exactly the nine non-hexagram Chinese canonical SEO pages", () => {
    expect(entries).toHaveLength(9);
    expect(entries.map((entry) => entry.canonicalUrl).sort()).toEqual([
      "/zh",
      "/zh/guides/changing-lines",
      "/zh/guides/how-to-ask-the-i-ching",
      "/zh/guides/primary-relating-hexagrams",
      "/zh/hexagrams",
      "/zh/methods/manual-cast",
      "/zh/methods/mei-hua-yi-shu",
      "/zh/methods/three-coin",
      "/zh/methods/yarrow-stalks",
    ]);
  });

  it("keeps route, intent and TDH values unique", () => {
    for (const field of ["routeId", "canonicalUrl", "searchIntent", "finalTitle", "finalDescription", "finalH1"] as const) {
      const values = entries.map((entry) => entry[field]);
      expect(new Set(values).size, field).toBe(entries.length);
    }
  });

  it("requires every exact Primary in Title, Description and H1", () => {
    for (const entry of entries) {
      expect(entry.finalTitle, entry.routeId).toContain(entry.primaryKeyword);
      expect(entry.finalDescription, entry.routeId).toContain(entry.primaryKeyword);
      expect(entry.finalH1, entry.routeId).toContain(entry.primaryKeyword);
      expect(entry.requiredPlacement, entry.routeId).toEqual(
        expect.arrayContaining(["title", "description", "h1", "early-copy", "h2"]),
      );
      if (entry.canonicalUrl === "/zh") {
        expect(entry.requiredPlacement, entry.routeId).not.toContain("inbound-anchor");
      } else {
        expect(entry.requiredPlacement, entry.routeId).toContain("inbound-anchor");
      }
    }
  });

  it("keeps the approved hard density bands and explicit research provenance", () => {
    for (const entry of entries) {
      expect(entry.primaryDensityMin, entry.routeId).toBeGreaterThan(0);
      expect(entry.primaryDensityMax, entry.routeId).toBeGreaterThanOrEqual(entry.primaryDensityMin);
      expect(entry.primaryDensityMax, entry.routeId).toBeLessThanOrEqual(5);
      expect(entry.familyDensityMin, entry.routeId).toBeGreaterThan(0);
      expect(entry.familyDensityMax, entry.routeId).toBeGreaterThanOrEqual(entry.familyDensityMin);
      expect(entry.familyDensityMax, entry.routeId).toBeLessThanOrEqual(11.0);
      if (entry.routeId === "hexagrams-hub") {
        expect(entry.familyDensityMax, entry.routeId).toBeLessThanOrEqual(2.0);
      } else if (entry.routeId === "homepage") {
        expect(entry.familyDensityMax, entry.routeId).toBeLessThanOrEqual(5.0);
      } else if (entry.canonicalUrl.startsWith("/zh/methods/")) {
        expect(entry.familyDensityMax, entry.routeId).toBeLessThanOrEqual(10.0);
      } else if (entry.canonicalUrl.startsWith("/zh/guides/")) {
        expect(entry.familyDensityMax, entry.routeId).toBeLessThanOrEqual(11.0);
      }
      expect(entry.researchEvidence.length, entry.routeId).toBeGreaterThan(0);
      expect(entry.researchEvidence.every((url) => /^https:\/\//.test(url)), entry.routeId).toBe(true);
      expect(entry.sourceNotes.trim().length, entry.routeId).toBeGreaterThan(10);
      expect(["VERIFIED", "UNVERIFIED"], entry.routeId).toContain(entry.researchStatus);
    }
  });

  it("does not invent quantitative SEO metrics when the source is unavailable", () => {
    for (const entry of entries) {
      if (entry.researchStatus !== "UNVERIFIED") continue;
      expect(entry.sourceNotes, entry.routeId).toMatch(/未验证|未取得|UNVERIFIED|不足/u);
      expect(entry.sourceNotes, entry.routeId).not.toMatch(/(?:Search Volume|KD|Competition)\s*[=:]\s*\d/iu);
    }
  });
});
