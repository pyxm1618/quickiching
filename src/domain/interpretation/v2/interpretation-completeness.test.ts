import { describe, expect, it } from "vitest";
import { loadHexagramInterpretation } from "./load-interpretation";

const PLACEHOLDER = /\b(?:TODO|TBD|Lorem ipsum|placeholder)\b/i;
const PROPHECY = /\b(?:will happen|your future will|(?:this|the) (?:reading|hexagram|line|cast) guarantees?|guarantees? (?:success|a result|an outcome|the future))\b/i;
const OLD_LINE_TEMPLATES = [
  /^For .+, the (?:foundation|inner center|inner threshold|outer entry|outer center|culmination) centers on one practical test:/i,
  /^Within .+, change at the (?:foundation|inner center|inner threshold|outer entry|outer center|culmination) sharpens this issue:/i,
  /^The risk at the (?:foundation|inner center|inner threshold|outer entry|outer center|culmination) is /i,
  /^At this (?:foundation|inner center|inner threshold|outer entry|outer center|culmination),/i,
  /(?:foundation|inner center|inner threshold|outer entry|outer center|culmination) change emphasizes the need to /i,
] as const;
const OLD_HEXAGRAM_TEMPLATES = [
  /Quick I Ching reads .+ as a whole-situation pattern rather than a prediction about a single event\./i,
  /^Where is .+ already present, and what evidence shows it is genuinely useful rather than merely appealing\?$/i,
  /^Where might .+ be distorting how you read the current situation\?$/i,
  /^What would it look like, in one concrete decision, to .+\?$/i,
  /^Concrete signs that .+ is becoming easier to sustain in practice\.$/i,
  /^Repeated situations where .+ appears and changes the quality of the outcome\.$/i,
  /^Moments when circumstances make it possible to .+\.$/i,
] as const;

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
  it("keeps the prophecy gate focused on deterministic product claims rather than warnings against certainty", () => {
    expect("This reading guarantees success.").toMatch(PROPHECY);
    expect("Your future will improve.").toMatch(PROPHECY);
    expect("Do not assume that energy guarantees correctness.").not.toMatch(PROPHECY);
  });

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

  it("uses authored line and hexagram prose rather than the old shared sentence templates", async () => {
    const bundles = await Promise.all(
      Array.from({ length: 64 }, (_, index) => loadHexagramInterpretation(index + 1)),
    );

    for (const { hexagram, lines } of bundles) {
      const hexagramFields = [hexagram.coreMeaning, ...hexagram.reflectionQuestions, ...hexagram.watchFor];
      for (const field of hexagramFields) {
        for (const template of OLD_HEXAGRAM_TEMPLATES) expect(field).not.toMatch(template);
      }

      for (const line of lines) {
        const lineFields = [line.meaning, line.changeDynamic, line.caution, line.reflection, line.synthesisPhrase];
        for (const field of lineFields) {
          for (const template of OLD_LINE_TEMPLATES) expect(field).not.toMatch(template);
        }
      }
    }
  });

  it("keeps review-critical line semantics distinct for Qian and Return", async () => {
    const qian = await loadHexagramInterpretation(1);
    expect(qian.lines[1].theme).toBe("Emerging into the field");
    expect(qian.lines[1].meaning).toMatch(/\bfield\b/i);
    expect(qian.lines[1].meaning).toMatch(/capable guidance/i);
    expect(qian.lines[4].theme).toBe("Visible creative leadership");
    expect(qian.lines[4].meaning).toMatch(/full visibility/i);
    expect(qian.lines[4].meaning).toMatch(/worthy counsel/i);

    const returning = await loadHexagramInterpretation(24);
    expect(returning.lines.map((line) => line.theme)).toEqual([
      "Return before distance grows",
      "Return with steady support",
      "Repeated return without self-punishment",
      "Returning against the surrounding current",
      "Sincere return made credible",
      "Missing the moment to return",
    ]);
  });

  it("guards against duplicate content and highly repetitive openings", async () => {
    const bundles = await Promise.all(
      Array.from({ length: 64 }, (_, index) => loadHexagramInterpretation(index + 1)),
    );
    const allLines = bundles.flatMap(({ lines }) => lines);

    expect(new Set(bundles.map(({ hexagram }) => hexagram.coreMeaning)).size).toBe(64);
    expect(new Set(allLines.map((line) => line.meaning)).size).toBe(384);
    expect(new Set(allLines.map((line) => line.changeDynamic)).size).toBe(384);
    expect(new Set(allLines.map((line) => line.caution)).size).toBeGreaterThanOrEqual(380);
    expect(new Set(allLines.map((line) => line.reflection)).size).toBe(384);
    expect(new Set(bundles.map(({ hexagram }) => hexagram.reflectionQuestions.join("|"))).size).toBe(64);
    expect(new Set(bundles.map(({ hexagram }) => hexagram.watchFor.join("|"))).size).toBe(64);

    expect(new Set(allLines.map((line) => openingSignature(line.meaning))).size).toBeGreaterThanOrEqual(340);
    expect(new Set(allLines.map((line) => openingSignature(line.changeDynamic))).size).toBeGreaterThanOrEqual(340);
    expect(new Set(allLines.map((line) => openingSignature(line.caution))).size).toBeGreaterThanOrEqual(320);
  });

  it("fails fast for an out-of-range hexagram lookup", async () => {
    await expect(loadHexagramInterpretation(0)).rejects.toThrow("HEXAGRAM_INTERPRETATION_MISSING: number=0");
    await expect(loadHexagramInterpretation(65)).rejects.toThrow("HEXAGRAM_INTERPRETATION_MISSING: number=65");
  });
});
