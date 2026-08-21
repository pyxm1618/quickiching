import { describe, expect, it } from "vitest";
import { CLASSICAL_HEXAGRAMS } from "@/domain/public-reading/classical";
import {
  HEXAGRAM_SEO_REGISTRY,
  HEXAGRAM_SEO_EN_SOURCE_SHA256,
  HEXAGRAM_SEO_ZH_SOURCE_SHA256,
  hexagramSeoFor,
  hexagramSeoRows,
} from "./seo";

describe("workbook-derived 128-page SEO registry", () => {
  it("contains exactly 64 English and 64 Simplified Chinese rows", () => {
    expect(hexagramSeoRows()).toHaveLength(128);
    expect(HEXAGRAM_SEO_REGISTRY.filter((entry) => entry.locale === "en")).toHaveLength(64);
    expect(HEXAGRAM_SEO_REGISTRY.filter((entry) => entry.locale === "zh-Hans")).toHaveLength(64);
    expect(HEXAGRAM_SEO_EN_SOURCE_SHA256).toBe("3924004150cc6190481a02257dd9e90731134cef417189c1b1e4a87e96da9a73");
    expect(HEXAGRAM_SEO_ZH_SOURCE_SHA256).toBe("c53e446dc0b168bbb459edf11342b58bc67031ca1436e9fc27a92cd58dbd25bc");
  });

  it("preserves every canonical English slug and derives the Chinese pair from it", () => {
    for (const classical of CLASSICAL_HEXAGRAMS) {
      const english = hexagramSeoFor(classical.number, "en");
      const chinese = hexagramSeoFor(classical.number, "zh-Hans");
      expect(english.slug).toBe(classical.slug);
      expect(english.canonicalUrl).toBe("https://www.quickiching.com/hexagrams/" + classical.slug);
      expect(chinese.slug).toBe(classical.slug);
      expect(chinese.canonicalUrl).toBe("https://www.quickiching.com/zh/hexagrams/" + classical.slug);
      expect(chinese.finalTitle).not.toBe(english.finalTitle);
    }
  });

  it("applies the exact English Global Exact Title and H1 structure to all 64 rows", () => {
    for (let number = 1; number <= 64; number += 1) {
      const entry = hexagramSeoFor(number, "en");
      expect(entry.primaryKeyword).toBe(`hexagram ${number}`);
      expect(entry.finalTitle).toBe(`I Ching Hexagram ${number}: ${entry.hexagramName} — Meaning, Love & Unchanging`);
      expect(entry.finalH1).toBe(`Hexagram ${number} — ${entry.hexagramName}`);
      expect(entry.finalDescription.toLocaleLowerCase("en-US")).toContain(`hexagram ${number}`);
      expect(entry.finalDescription.toLocaleLowerCase("en-US")).toContain("love");
      expect(entry.finalDescription.toLocaleLowerCase("en-US")).toContain("unchanging");
      expect(entry.finalDescription.length).toBeGreaterThanOrEqual(100);
      expect(entry.finalDescription.length).toBeLessThanOrEqual(160);
    }
    expect(hexagramSeoFor(14, "en").hexagramName).toBe("Possession in Great Measure");
    expect(hexagramSeoFor(18, "en").hexagramName).toBe("Work on What Has Been Spoiled");
    expect(hexagramSeoFor(25, "en").hexagramName).toBe("Innocence (The Unexpected)");
  });

  it("keeps TDH unique and replaces superseded English special modules", () => {
    for (const field of ["canonicalUrl", "finalTitle", "finalDescription", "finalH1"] as const) {
      const values = HEXAGRAM_SEO_REGISTRY.map((entry) => entry[field]);
      expect(new Set(values).size, field).toBe(128);
    }
    expect(hexagramSeoFor(23, "en").specialKeywords).toContain("i ching hexagram 23 meaning splitting apart bo");
    expect(hexagramSeoFor(54, "en").specialKeywords).toContain("hexagram 54 in romance reading");
    expect(hexagramSeoFor(52, "en").specialKeywords).toEqual([]);
    expect(hexagramSeoFor(61, "en").specialKeywords).toEqual([]);
    expect(hexagramSeoFor(64, "en").specialKeywords).toEqual([]);
    expect(hexagramSeoFor(64, "zh-Hans").specialSerpModule).toContain("六十四卦");
  });

  it("preserves workbook core-secondary order and conditional relationship modules", () => {
    expect(hexagramSeoFor(1, "en").secondaryCore).toBe("i ching hexagram 1");
    expect(hexagramSeoFor(1, "en").otherCoreVariant).toBe("iching hexagram 1");
    expect(hexagramSeoFor(7, "en").secondaryCore).toBe("iching hexagram 7");
    expect(hexagramSeoFor(7, "en").otherCoreVariant).toBe("i ching hexagram 7");

    const relationshipNumbers = HEXAGRAM_SEO_REGISTRY
      .filter((entry) => entry.locale === "en" && entry.relationshipKeyword)
      .map((entry) => entry.number);
    expect(relationshipNumbers).toEqual([1, 26, 37, 41, 42, 49, 54, 56]);
  });

  it("retains workbook keyword mapping and placement instructions as source data", () => {
    for (const entry of HEXAGRAM_SEO_REGISTRY) {
      expect(entry.primaryKeyword.length).toBeGreaterThan(0);
      expect(entry.secondaryCore.length).toBeGreaterThan(0);
      expect(entry.requiredPlacement).toContain("Title");
      expect(entry.requiredPlacement).toContain("H1");
      expect(entry.requiredPlacement.toLowerCase()).toContain("meta");
      expect(entry.requiredContent).toContain("#line-1");
      expect(entry.requiredContent).toContain("#line-6");
      expect(entry.exactPrimaryStandard).toContain("1.00%-2.00%");
      expect(entry.familyDensityMin).toBe(0.03);
      expect(entry.familyDensityMax).toBe(0.05);
      expect(entry.brandMentionsInBodyMax).toBe(0);
    }
  });
});
