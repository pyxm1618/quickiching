import { describe, expect, it } from "vitest";
import { CLASSICAL_HEXAGRAMS } from "@/domain/public-reading/classical";
import { ZH_HANS_HEXAGRAM_CONTENT, zhHansHexagramContent } from "./zh-Hans";

const MODERN_FIELDS = ["coreMeaning", "practicalUnderstanding", "realityUnderstanding", "supports", "watchFor", "lineNotes"] as const;

function sentences(value: string): string[] {
  return value.split(/[。！？!?；;]\s*/u).map((sentence) => sentence.trim()).filter(Boolean);
}

function structureSignature(value: string): string {
  return value
    .replace(/[“「『【][^”」』】]*[”」』】]/gu, "〈page-specific〉")
    .replace(/\s+/gu, "")
    .replace(/[，。！？!?；;：、]/gu, "");
}

describe("Simplified Chinese hexagram detail localized content", () => {
  it("contains one complete localized record for every King Wen entity", () => {
    expect(Object.keys(ZH_HANS_HEXAGRAM_CONTENT)).toHaveLength(64);
    for (const classical of CLASSICAL_HEXAGRAMS) {
      const content = zhHansHexagramContent(classical.number);
      expect(content.number).toBe(classical.number);
      expect(content.theme.length).toBeGreaterThan(0);
      expect(content.coreMeaning.length).toBeGreaterThan(20);
      expect(content.practicalUnderstanding.length).toBeGreaterThan(20);
      expect(content.realityUnderstanding.length).toBeGreaterThan(50);
      expect(content.supports).toHaveLength(2);
      expect(content.watchFor).toHaveLength(2);
      expect(content.lineNotes).toHaveLength(6);
      expect(content.lineNotes.every((note) => note.length > 18)).toBe(true);
    }
  });

  it("does not retain fields that existed only for the retired Chinese detail presentation", () => {
    for (const content of Object.values(ZH_HANS_HEXAGRAM_CONTENT)) {
      expect("sceneModule" in content).toBe(false);
      expect("unchanging" in content).toBe(false);
      expect("reflectionQuestions" in content).toBe(false);
    }
  });

  it("uses Chinese product terminology and avoids unsupported deterministic claims", () => {
    const fullText = Object.values(ZH_HANS_HEXAGRAM_CONTENT)
      .flatMap((content) => [
        content.theme,
        content.coreMeaning,
        content.practicalUnderstanding,
        content.realityUnderstanding,
        ...content.supports,
        ...content.watchFor,
        ...content.lineNotes,
      ])
      .join("\n");
    for (const required of ["易经", "周易", "起卦", "本卦", "动爻", "卦辞", "爻辞"]) {
      expect(fullText).toContain(required);
    }
    for (const forbidden of ["命中注定", "一定会发生", "宇宙告诉你", "纳甲", "六亲", "世应", "用神"]) {
      expect(fullText).not.toContain(forbidden);
    }
  });

  it("does not expose multi-word English editorial phrases in Chinese localized copy", () => {
    const fullText = Object.values(ZH_HANS_HEXAGRAM_CONTENT)
      .flatMap((content) => [
        content.theme,
        content.coreMeaning,
        content.practicalUnderstanding,
        content.realityUnderstanding,
        ...content.supports,
        ...content.watchFor,
        ...content.lineNotes,
      ])
      .join("\n");
    const englishEditorialPhrases = fullText.match(/\b[A-Za-z]+[ \t]+[A-Za-z]+(?:[ \t]+[A-Za-z]+)*\b/gu) ?? [];
    expect(englishEditorialPhrases).toEqual([]);
  });

  it("keeps each page’s practical and line guidance distinct", () => {
    const practical = Object.values(ZH_HANS_HEXAGRAM_CONTENT).map((content) => content.practicalUnderstanding);
    expect(new Set(practical).size).toBe(64);
    const lineSets = Object.values(ZH_HANS_HEXAGRAM_CONTENT).map((content) => content.lineNotes.join("|"));
    expect(new Set(lineSets).size).toBe(64);
  });

  it("does not reuse a complete modern-explanation sentence across ten or more pages", () => {
    const sentenceCounts = new Map<string, number>();
    for (const classical of CLASSICAL_HEXAGRAMS) {
      const content = zhHansHexagramContent(classical.number);
      for (const field of MODERN_FIELDS) {
        const value = content[field];
        const values = Array.isArray(value) ? value : [value];
        for (const item of values) {
          for (const sentence of sentences(String(item))) {
            sentenceCounts.set(sentence, (sentenceCounts.get(sentence) ?? 0) + 1);
          }
        }
      }
    }
    const repeated = [...sentenceCounts.entries()].filter(([, count]) => count >= 10);
    expect(repeated, repeated.map(([sentence, count]) => count + "x " + sentence).join("\n")).toEqual([]);
  });

  it("does not reuse a page-independent sentence structure across ten or more pages", () => {
    const structures = new Map<string, Set<number>>();
    for (const classical of CLASSICAL_HEXAGRAMS) {
      const content = zhHansHexagramContent(classical.number);
      for (const field of MODERN_FIELDS) {
        const value = content[field];
        const values = Array.isArray(value) ? value : [value];
        for (const item of values) {
          const signature = structureSignature(String(item));
          const pages = structures.get(signature) ?? new Set<number>();
          pages.add(classical.number);
          structures.set(signature, pages);
        }
      }
    }
    const repeated = [...structures.entries()]
      .filter(([, pages]) => pages.size >= 10)
      .sort(([, left], [, right]) => right.size - left.size);
    expect(repeated, repeated.map(([signature, pages]) => pages.size + " pages: " + signature).join("\n")).toEqual([]);
  });
});
