import { describe, expect, it } from "vitest";
import { BINARY_TO_KING_WEN, KING_WEN_HEXAGRAMS, TRIGRAM_BITS } from "@/domain/casting/hexagrams/king-wen";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";
import { CLASSICAL_HEXAGRAMS } from "./classical";
import { EDITORIAL_EN_RENDERINGS } from "./editorial-en-renderings";
import { buildPublicHexagramKnowledgeDetail } from "./knowledge-detail";

const PLACEHOLDER = /\b(?:TODO|TBD|Lorem ipsum|placeholder)\b/i;

function patternFor(number: number): number {
  const def = KING_WEN_HEXAGRAMS[number - 1];
  if (!def) throw new Error(`TEST_HEXAGRAM_MISSING: ${number}`);
  return (TRIGRAM_BITS[def.upper] << 3) | TRIGRAM_BITS[def.lower];
}

function reverseSixBits(value: number): number {
  let reversed = 0;
  for (let index = 0; index < 6; index += 1) {
    if ((value & (1 << index)) !== 0) reversed |= 1 << (5 - index);
  }
  return reversed;
}

describe("English hexagram knowledge detail data", () => {
  it("keeps exactly 64 source records and 384 ordered ordinary line renderings", () => {
    expect(CLASSICAL_HEXAGRAMS).toHaveLength(64);
    expect(Object.keys(EDITORIAL_EN_RENDERINGS).map(Number).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 64 }, (_, index) => index + 1),
    );

    const ordinaryLines = Object.values(EDITORIAL_EN_RENDERINGS).flatMap((entry) => entry.lines);
    expect(ordinaryLines).toHaveLength(384);
    expect(ordinaryLines.every((value) => value.trim().length > 0)).toBe(true);
  });

  it("binds judgment, image, and every line rendering to the exact classical source record and fixed revision", async () => {
    for (const classical of CLASSICAL_HEXAGRAMS) {
      const bundle = await loadHexagramInterpretation(classical.number);
      const detail = buildPublicHexagramKnowledgeDetail(classical, bundle);

      expect(detail.judgment.rendering).toMatchObject({
        dataClass: "source-derived",
        editorialAttribution: "Quick I Ching editorial rendering",
        sourceField: "judgment",
        hexagramNumber: classical.number,
        sourceText: classical.judgment,
        fixedSourceRevision: classical.source.textSourceRevision,
        sourceUrl: classical.source.textSourceUrl,
      });
      expect(detail.image.rendering).toMatchObject({
        dataClass: "source-derived",
        editorialAttribution: "Quick I Ching editorial rendering",
        sourceField: "image",
        hexagramNumber: classical.number,
        sourceText: classical.image,
        fixedSourceRevision: classical.source.textSourceRevision,
        sourceUrl: classical.source.textSourceUrl,
      });

      expect(detail.lines).toHaveLength(6);
      for (let index = 0; index < 6; index += 1) {
        const classicalLine = classical.lines[index];
        const line = detail.lines[index];
        const existing = bundle.lines[index];
        expect(line.position).toBe(index + 1);
        expect(line.rendering).toMatchObject({
          dataClass: "source-derived",
          editorialAttribution: "Quick I Ching editorial rendering",
          sourceField: "line",
          hexagramNumber: classical.number,
          linePosition: index + 1,
          sourceText: classicalLine.text,
          fixedSourceRevision: classicalLine.source.textSourceRevision,
          sourceUrl: classicalLine.source.textSourceUrl,
        });
        expect(line.rendering.editorialRendering.trim().length).toBeGreaterThan(0);
        expect(line.stageState).toBeUndefined();
        expect(line.modernMeaning.text).toBe(existing.meaning);
        expect(line.changeDynamic.text).toBe(existing.changeDynamic);
        expect(line.caution.text).toBe(existing.caution);
        expect(line.reflection.text).toBe(existing.reflection);
        expect(line.synthesis.text).toBe(existing.synthesisPhrase);
      }

      expect(detail.judgment.modernInterpretation.text).toBe(bundle.hexagram.coreMeaning);
      expect(detail.image.modernInterpretation.text).toBe(bundle.hexagram.structureInterpretation);
      expect(detail.judgment.modernInterpretation.dataClass).toBe("editorial-derived");
      expect(detail.image.modernInterpretation.dataClass).toBe("editorial-derived");
    }
  });

  it("models only Qian Use of Nine and Kun Use of Six as source-derived special cases", async () => {
    const caseNumbers: number[] = [];
    for (const classical of CLASSICAL_HEXAGRAMS) {
      const detail = buildPublicHexagramKnowledgeDetail(
        classical,
        await loadHexagramInterpretation(classical.number),
      );
      if (detail.specialReadingCases.length > 0) caseNumbers.push(classical.number);
    }
    expect(caseNumbers).toEqual([1, 2]);

    const qian = CLASSICAL_HEXAGRAMS[0];
    const kun = CLASSICAL_HEXAGRAMS[1];
    const qianDetail = buildPublicHexagramKnowledgeDetail(qian, await loadHexagramInterpretation(1));
    const kunDetail = buildPublicHexagramKnowledgeDetail(kun, await loadHexagramInterpretation(2));

    expect(qianDetail.specialReadingCases[0]?.rendering).toMatchObject({
      sourceField: "use-line",
      sourceText: "见群龙无首，吉。",
      fixedSourceRevision: qian.source.textSourceRevision,
      editorialRendering: "Seeing a group of dragons without a leader. Auspicious.",
    });
    expect(kunDetail.specialReadingCases[0]?.rendering).toMatchObject({
      sourceField: "use-line",
      sourceText: "利永贞。",
      fixedSourceRevision: kun.source.textSourceRevision,
      editorialRendering: "Favorable to remain steadfast for the long term.",
    });
  });

  it("keeps relationships deterministic, valid, non-self, and structurally verifiable", async () => {
    for (const classical of CLASSICAL_HEXAGRAMS) {
      const detail = buildPublicHexagramKnowledgeDetail(
        classical,
        await loadHexagramInterpretation(classical.number),
      );
      const sourcePattern = patternFor(classical.number);

      expect(detail.relationships.length).toBeGreaterThanOrEqual(1);
      for (const relation of detail.relationships) {
        expect(relation.sourceHexagram).toBe(classical.number);
        expect(relation.relatedHexagram).toBeGreaterThanOrEqual(1);
        expect(relation.relatedHexagram).toBeLessThanOrEqual(64);
        expect(relation.relatedHexagram).not.toBe(classical.number);
        expect(relation.provenance.dataClass).toBe("editorial-derived");
        expect(relation.provenance.verificationBasis.trim().length).toBeGreaterThan(20);

        const expectedPattern =
          relation.relationType === "structural-complement"
            ? sourcePattern ^ 0b111111
            : reverseSixBits(sourcePattern);
        expect(BINARY_TO_KING_WEN.get(expectedPattern)).toBe(relation.relatedHexagram);
      }
    }
  });

  it("contains no placeholders and no long duplicate rendering attached to different source text", async () => {
    const seen = new Map<string, string>();

    for (const classical of CLASSICAL_HEXAGRAMS) {
      const detail = buildPublicHexagramKnowledgeDetail(
        classical,
        await loadHexagramInterpretation(classical.number),
      );
      const sourcePairs = [
        [detail.judgment.rendering.sourceText, detail.judgment.rendering.editorialRendering],
        [detail.image.rendering.sourceText, detail.image.rendering.editorialRendering],
        ...detail.lines.map((line) => [line.rendering.sourceText, line.rendering.editorialRendering] as const),
        ...detail.specialReadingCases.map((item) => [item.rendering.sourceText, item.rendering.editorialRendering] as const),
      ] as const;

      for (const [sourceText, rendering] of sourcePairs) {
        expect(rendering).not.toMatch(PLACEHOLDER);
        expect(rendering.trim().length).toBeGreaterThan(0);
        if (rendering.trim().split(/\s+/).length < 8) continue;
        const priorSource = seen.get(rendering);
        if (priorSource !== undefined) expect(sourceText).toBe(priorSource);
        else seen.set(rendering, sourceText);
      }
    }
  });

  it("keeps optional special-case data empty when the source has no special use line", async () => {
    for (const classical of CLASSICAL_HEXAGRAMS.slice(2)) {
      const detail = buildPublicHexagramKnowledgeDetail(
        classical,
        await loadHexagramInterpretation(classical.number),
      );
      expect(classical.useLine).toBeUndefined();
      expect(detail.specialReadingCases).toEqual([]);
    }
  });
});
