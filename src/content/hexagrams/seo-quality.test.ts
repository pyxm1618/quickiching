import { describe, expect, it } from "vitest";
import {
  FAMILY_DENSITY_RANGE,
  PRIMARY_DENSITY_RANGE,
  countExactPhrase,
  evaluateKeywordQuality,
  findLanguageContamination,
  measureKeywordQuality,
  tokenizeWithSpans,
} from "./seo-quality";

describe("hexagram SEO quality primitives", () => {
  it("matches an English Primary on token boundaries instead of numeric prefixes", () => {
    expect(countExactPhrase("hexagram 10", "hexagram 1", "en")).toBe(0);
    expect(countExactPhrase("Hexagram 1; I Ching Hexagram 1.", "hexagram 1", "en")).toBe(2);
    expect(countExactPhrase("hexagram 1.1 is a line query", "hexagram 1", "en")).toBe(1);
  });

  it("matches protected Chinese phrases without partial-script heuristics", () => {
    expect(countExactPhrase("乾卦详解，乾卦没有动爻。", "乾卦", "zh-Hans")).toBe(2);
    expect(countExactPhrase("乾为天详解", "乾卦", "zh-Hans")).toBe(0);
  });

  it("tokenizes both locales with stable source spans", () => {
    expect(tokenizeWithSpans("Hexagram 23 — love", "en").map((token) => token.value)).toEqual([
      "Hexagram",
      "23",
      "love",
    ]);
    expect(tokenizeWithSpans("乾卦没有动爻", "zh-Hans").every((token) => token.end > token.start)).toBe(true);
  });

  it("uses longest non-overlapping approved phrases and counts covered tokens once", () => {
    const quality = measureKeywordQuality({
      text: "i ching hexagram 23; hexagram 23 meaning; love; unchanging",
      locale: "en",
      primary: "hexagram 23",
      approvedFamily: [
        "hexagram 23",
        "i ching hexagram 23",
        "hexagram 23 meaning",
        "love",
        "unchanging",
      ],
    });

    expect(quality.tokenCount).toBe(9);
    expect(quality.primaryOccurrences).toBe(2);
    expect(quality.familyCoveredTokens).toBe(9);
    expect(quality.familyMatches.map((match) => match.phrase)).toEqual([
      "i ching hexagram 23",
      "hexagram 23 meaning",
      "love",
      "unchanging",
    ]);
    expect(quality.primaryDensity).toBeCloseTo(2 / 9, 8);
    expect(quality.familyDensity).toBe(1);
    expect(quality.familyDensityBasis).toBe("covered-tokens");
  });

  it("counts complete approved Chinese phrases without multi-character name inflation", () => {
    const quality = measureKeywordQuality({
      text: "泽天夬用于观察决断，泽天夬无动爻时仍需复核现实。",
      locale: "zh-Hans",
      primary: "泽天夬",
      approvedFamily: ["泽天夬", "泽天夬无动爻"],
    });
    expect(quality.familyMatches).toHaveLength(2);
    expect(quality.familyDensity).toBeCloseTo(2 / quality.tokenCount, 8);
    expect(quality.familyDensityBasis).toBe("matched-phrases");
  });

  it("detects only the other locale script as contamination", () => {
    expect(findLanguageContamination("English copy 乾", "en")).toEqual({
      count: 1,
      samples: ["乾"],
    });
    expect(findLanguageContamination("中文 copy", "zh-Hans")).toEqual({
      count: 1,
      samples: ["copy"],
    });
    expect(findLanguageContamination("Hexagram 1 love", "en").count).toBe(0);
    expect(findLanguageContamination("乾卦详解", "zh-Hans").count).toBe(0);
  });

  it("publishes the approved hard density bands", () => {
    expect(PRIMARY_DENSITY_RANGE).toEqual({ min: 0.01, max: 0.02 });
    expect(FAMILY_DENSITY_RANGE).toEqual({ min: 0.03, max: 0.05 });
  });

  it("turns density and language purity into hard failures", () => {
    const passingText = [
      "hexagram 1",
      ...Array.from({ length: 93 }, (_, index) => `word${index}`),
      "hexagram 1 love",
      "meaning",
      "unchanging",
    ].join(" ");
    const passing = evaluateKeywordQuality({
      text: passingText,
      locale: "en",
      primary: "hexagram 1",
      approvedFamily: ["hexagram 1", "hexagram 1 love"],
    });
    expect(passing.measurement.tokenCount).toBe(100);
    expect(passing.measurement.primaryDensity).toBe(0.02);
    expect(passing.measurement.familyDensity).toBe(0.05);
    expect(passing.failures).toEqual([]);

    const failing = evaluateKeywordQuality({
      text: `${passingText} hexagram 1 hexagram 1 hexagram 1 乾`,
      locale: "en",
      primary: "hexagram 1",
      approvedFamily: ["hexagram 1", "hexagram 1 love"],
    });
    expect(failing.failures).toContain("language-contamination:1");
    expect(failing.failures).toContain("primary-density:outside-0.0100-0.0200");
    expect(failing.failures).toContain("family-density:outside-0.0300-0.0500");
  });
});
