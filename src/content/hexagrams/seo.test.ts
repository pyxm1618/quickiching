import { describe, expect, it } from "vitest";
import { CLASSICAL_HEXAGRAMS } from "@/domain/public-reading/classical";
import {
  HEXAGRAM_SEO_REGISTRY,
  HEXAGRAM_SEO_SOURCE_SHA256,
  hexagramSeoFor,
  hexagramSeoRows,
} from "./seo";

describe("workbook-derived 128-page SEO registry", () => {
  it("contains exactly 64 English and 64 Simplified Chinese rows", () => {
    expect(hexagramSeoRows()).toHaveLength(128);
    expect(HEXAGRAM_SEO_REGISTRY.filter((entry) => entry.locale === "en")).toHaveLength(64);
    expect(HEXAGRAM_SEO_REGISTRY.filter((entry) => entry.locale === "zh-Hans")).toHaveLength(64);
    expect(HEXAGRAM_SEO_SOURCE_SHA256).toBe("c53e446dc0b168bbb459edf11342b58bc67031ca1436e9fc27a92cd58dbd25bc");
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

  it("keeps TDH unique and exact source rows available for special entities", () => {
    for (const field of ["canonicalUrl", "finalTitle", "finalDescription", "finalH1"] as const) {
      const values = HEXAGRAM_SEO_REGISTRY.map((entry) => entry[field]);
      expect(new Set(values).size, field).toBe(128);
    }
    expect(hexagramSeoFor(23, "en").finalTitle).toBe("Hexagram 23 Meaning: Bo (Splitting Apart) | Quick I Ching");
    expect(hexagramSeoFor(52, "en").specialSerpModule).toContain("Line 3");
    expect(hexagramSeoFor(54, "en").specialSerpModule).toContain("consent");
    expect(hexagramSeoFor(61, "en").specialSerpModule).toContain("Line 5");
    expect(hexagramSeoFor(64, "en").specialSerpModule).toContain("64 hexagrams");
    expect(hexagramSeoFor(64, "zh-Hans").specialSerpModule).toContain("六十四卦");
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
      expect(entry.exactPrimaryStandard.toLowerCase()).toMatch(/no universal|不设机械/u);
      expect(entry.brandMentionsInBodyMax).toBe(2);
    }
  });
});
