import { loadPublicHexagramKnowledge } from "@/domain/public-reading/knowledge";
import type { DeterministicFacts } from "@/domain/generation/schemas";
import {
  deepReadingKnowledgeBundleSchema,
  type DeepReadingKnowledgeBundle,
} from "@/domain/generation/deep-reading-contract";

export const DEEP_READING_KNOWLEDGE_VERSION = "quickiching-knowledge-v1";

export async function buildDeepReadingKnowledgeBundle(
  facts: DeterministicFacts,
): Promise<DeepReadingKnowledgeBundle> {
  const primary = await loadPublicHexagramKnowledge(facts.primaryHexagramNumber);
  const relating = facts.relatingHexagramNumber === null
    ? null
    : await loadPublicHexagramKnowledge(facts.relatingHexagramNumber);
  const evidence: DeepReadingKnowledgeBundle["evidence"] = [];

  function addEvidence(
    id: string,
    source: DeepReadingKnowledgeBundle["evidence"][number]["source"],
    hexagramNumber: number,
    content: string,
    linePosition?: number,
  ) {
    evidence.push({ id, source, hexagramNumber, content, ...(linePosition === undefined ? {} : { linePosition }) });
  }

  addEvidence("primary.judgment", "king_wen_judgment", primary.number, primary.judgment);
  addEvidence("primary.image", "king_wen_image", primary.number, primary.image);
  addEvidence("primary.core_theme", "interpretation_theme", primary.number, primary.interpretation.coreTheme);
  addEvidence("primary.core_meaning", "interpretation_meaning", primary.number, primary.interpretation.coreMeaning);
  addEvidence("primary.strength", "interpretation_strength", primary.number, primary.interpretation.strength);
  addEvidence("primary.challenge", "interpretation_challenge", primary.number, primary.interpretation.challenge);
  addEvidence("primary.orientation", "interpretation_orientation", primary.number, primary.interpretation.orientation);
  addEvidence("primary.structure", "interpretation_structure", primary.number, primary.interpretation.structureInterpretation);
  if (facts.readingVariant !== "still_hexagram") {
    addEvidence("primary.transition", "interpretation_transition", primary.number, primary.interpretation.transitionTheme);
  }
  addEvidence("primary.stability", "interpretation_stability", primary.number, primary.interpretation.stabilityTheme);

  const changingLines = facts.movingLinePositions.map((position) => {
    const lineValue = facts.lineValuesBottomUp[position - 1];
    const classicalLine = primary.classicalLines[position - 1];
    const authoredLine = primary.lines[position - 1];
    if (!lineValue || (lineValue !== 6 && lineValue !== 9) || !classicalLine || !authoredLine || authoredLine.position !== position) {
      throw new Error(`DEEP_READING_KNOWLEDGE_LINE_MISMATCH: line=${position}`);
    }

    addEvidence(`primary.line.${position}.classical`, "king_wen_line", primary.number, classicalLine.text, position);
    addEvidence(`primary.line.${position}.theme`, "line_theme", primary.number, authoredLine.theme, position);
    addEvidence(`primary.line.${position}.meaning`, "line_meaning", primary.number, authoredLine.meaning, position);
    addEvidence(`primary.line.${position}.dynamic`, "line_dynamic", primary.number, authoredLine.changeDynamic, position);
    addEvidence(`primary.line.${position}.caution`, "line_caution", primary.number, authoredLine.caution, position);
    addEvidence(`primary.line.${position}.reflection`, "line_reflection", primary.number, authoredLine.reflection, position);

    return {
      position,
      lineValue,
      classicalText: classicalLine.text,
      theme: authoredLine.theme,
      meaning: authoredLine.meaning,
      changeDynamic: authoredLine.changeDynamic,
      caution: authoredLine.caution,
      reflection: authoredLine.reflection,
      synthesisPhrase: authoredLine.synthesisPhrase,
    };
  });

  if (relating) {
    addEvidence("relating.judgment", "relating_judgment", relating.number, relating.judgment);
    addEvidence("relating.image", "relating_image", relating.number, relating.image);
    addEvidence("relating.core_meaning", "relating_meaning", relating.number, relating.interpretation.coreMeaning);
  }

  const structuralChange = changingLines.length === 0
    ? `No lines change. The cast remains centered on ${primary.interpretation.stabilityTheme}.`
    : relating
      ? `${changingLines.length} changing line${changingLines.length === 1 ? "" : "s"} (${changingLines.map(({ position }) => position).join(", ")}) transform the primary hexagram ${primary.number} into relating hexagram ${relating.number}.`
      : `The active lines are ${changingLines.map(({ position }) => position).join(", ")}; no relating hexagram is recorded.`;

  return deepReadingKnowledgeBundleSchema.parse({
    version: DEEP_READING_KNOWLEDGE_VERSION,
    primary: {
      number: primary.number,
      name: primary.englishName,
      chineseName: primary.chineseName,
      judgment: primary.judgment,
      image: primary.image,
      interpretation: {
        coreTheme: primary.interpretation.coreTheme,
        coreMeaning: primary.interpretation.coreMeaning,
        strength: primary.interpretation.strength,
        challenge: primary.interpretation.challenge,
        orientation: primary.interpretation.orientation,
        structureInterpretation: primary.interpretation.structureInterpretation,
        transitionTheme: primary.interpretation.transitionTheme,
        stabilityTheme: primary.interpretation.stabilityTheme,
      },
    },
    changingLines,
    relating: relating ? {
      number: relating.number,
      name: relating.englishName,
      chineseName: relating.chineseName,
      judgment: relating.judgment,
      image: relating.image,
      coreMeaning: relating.interpretation.coreMeaning,
      orientation: relating.interpretation.orientation,
    } : null,
    structuralChange,
    evidence,
  });
}
