import { describe, expect, it } from "vitest";
import { loadHexagramInterpretation } from "./load-interpretation";

const PLACEHOLDER = /\b(?:TODO|TBD|Lorem ipsum|placeholder)\b/i;
const PROPHECY = /\b(?:will happen|your future will|guarantees?)\b/i;

function words(value: string): string[] {
  return value.trim().split(/\s+/).filter(Boolean);
}

function wordCount(value: string): number {
  return words(value).length;
}

function openingSignature(value: string): string {
  return words(value).slice(0, 12).join(" ").toLowerCase();
}

describe("Free Reading V2 interpretation catalog", () => {
  it("contains exactly 64 complete hexagrams and 384 complete line interpretations", async () => {
    const bundles = await Promise.all(
      Array.from({ length: 64 }, (_, index) => loadHexagramInterpretation(index + 1)),
    );
    expect(bundles).toHaveLength(64);
    expect(bundles.map(({ hexagram }) => hexagram.number)).toEqual(
      Array.from({ length: 64 }, (_, index) => index + 1),
    );

    const allLines = bundles.flatMap(({ lines }) => lines);
    expect(allLines).toHaveLength(384);
    expect(new Set(allLines.map((line) => `${line.hexagramNumber}:${line.position}`)).size).toBe(384);

    for (const bundle of bundles) {
      expect(bundle.lines).toHaveLength(6);
      expect(bundle.lines.map((line) => line.position)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(bundle.lines.every((line) => line.hexagramNumber === bundle.hexagram.number)).toBe(true);
    }
  });

  it("keeps every required field substantive and free of placeholders or deterministic prophecy", async () => {
    const bundles = await Promise.all(
      Array.from({ length: 64 }, (_, index) => loadHexagramInterpretation(index + 1)),
    );

    for (const { hexagram, lines } of bundles) {
      const proseFields = [
        hexagram.coreMeaning,
        hexagram.strength,
        hexagram.challenge,
        hexagram.orientation,
        hexagram.structureInterpretation,
        hexagram.transitionTheme,
        hexagram.stabilityTheme,
        ...hexagram.reflectionQuestions,
        ...hexagram.watchFor,
      ];
      expect(hexagram.coreTheme.trim().length).toBeGreaterThan(3);
      expect(proseFields.every((value) => value.trim().length > 12)).toBe(true);
      expect(wordCount(hexagram.coreMeaning)).toBeGreaterThanOrEqual(90);
      expect(wordCount(hexagram.coreMeaning)).toBeLessThanOrEqual(190);
      expect(hexagram.reflectionQuestions).toHaveLength(3);
      expect(hexagram.watchFor).toHaveLength(3);

      for (const line of lines) {
        expect(line.theme.trim().length).toBeGreaterThan(8);
        expect(line.meaning.trim().length).toBeGreaterThan(80);
        expect(line.changeDynamic.trim().length).toBeGreaterThan(60);
        expect(line.caution.trim().length).toBeGreaterThan(45);
        expect(line.reflection.trim().endsWith("?")).toBe(true);
        expect(line.synthesisPhrase.trim().length).toBeGreaterThan(24);
      }

      const combined = [hexagram.coreTheme, ...proseFields, ...lines.flatMap((line) => [
        line.theme,
        line.meaning,
        line.changeDynamic,
        line.caution,
        line.reflection,
        line.synthesisPhrase,
      ])].join(" ");
      expect(combined).not.toMatch(PLACEHOLDER);
      expect(combined).not.toMatch(PROPHECY);
    }
  });

  it("guards against duplicate content and a highly repetitive line template", async () => {
    const bundles = await Promise.all(
      Array.from({ length: 64 }, (_, index) => loadHexagramInterpretation(index + 1)),
    );
    const allLines = bundles.flatMap(({ lines }) => lines);

    expect(new Set(bundles.map(({ hexagram }) => hexagram.coreMeaning)).size).toBe(64);
    expect(new Set(allLines.map((line) => line.meaning)).size).toBe(384);
    expect(new Set(allLines.map((line) => line.changeDynamic)).size).toBe(384);
    expect(new Set(allLines.map((line) => line.caution)).size).toBeGreaterThanOrEqual(360);
    expect(new Set(bundles.map(({ hexagram }) => hexagram.reflectionQuestions.join("|"))).size).toBe(64);

    expect(new Set(allLines.map((line) => openingSignature(line.meaning))).size).toBeGreaterThanOrEqual(300);
    expect(new Set(allLines.map((line) => openingSignature(line.changeDynamic))).size).toBeGreaterThanOrEqual(300);
  });

  it("fails fast for an out-of-range hexagram lookup", async () => {
    await expect(loadHexagramInterpretation(0)).rejects.toThrow("HEXAGRAM_INTERPRETATION_MISSING: number=0");
    await expect(loadHexagramInterpretation(65)).rejects.toThrow("HEXAGRAM_INTERPRETATION_MISSING: number=65");
  });
});
