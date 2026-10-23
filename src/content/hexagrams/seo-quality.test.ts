import { describe, expect, it } from "vitest";
import {
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

  it("treats density as diagnostic while requiring the primary keyword and a clear main language", () => {
    const sparse = evaluateKeywordQuality({
      text: "Hexagram 1 is discussed here with the traditional name 乾 and a short cultural note.",
      locale: "en",
      primary: "hexagram 1",
      approvedFamily: ["hexagram 1", "hexagram 1 meaning"],
    });
    expect(sparse.measurement.primaryDensity).toBeGreaterThan(0);
    expect(sparse.primaryPresent).toBe(true);
    expect(sparse.languageMostlyCorrect).toBe(true);
    expect(sparse.failures).toEqual([]);

    const missing = evaluateKeywordQuality({
      text: "A general discussion without the target phrase.",
      locale: "en",
      primary: "hexagram 1",
      approvedFamily: ["hexagram 1"],
    });
    expect(missing.failures).toContain("primary-keyword:missing");
  });
});
