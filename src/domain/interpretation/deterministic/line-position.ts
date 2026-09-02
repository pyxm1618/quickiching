import type { LineValue } from "@/domain/casting/types";

// 爻位 — positional structure of a single line inside its hexagram. Every field
// here follows a fixed classical rule, so the reading can state why a line is
// strong or precarious instead of asserting it.

export type LinePolarity = "yang" | "yin";

export type LinePositionAnalysis = {
  position: number;
  polarity: LinePolarity;
  moving: boolean;
  // 当位 — yang in an odd place, yin in an even place.
  correctPlace: boolean;
  // 得中 — second place (inner centre) or fifth (outer centre).
  central: boolean;
  // 中正 — both central and correctly placed.
  centralAndCorrect: boolean;
  // 相应 — 1-4, 2-5, 3-6 correspond when their polarities differ.
  correspondence: { position: number; responding: boolean };
  // 承乘 — relation to the line immediately above and below.
  ridesYang: boolean;
};

export function polarityOf(value: LineValue): LinePolarity {
  // 7 young yang and 9 old yang are yang; 6 old yin and 8 young yin are yin.
  return value === 7 || value === 9 ? "yang" : "yin";
}

export function isMoving(value: LineValue): boolean {
  return value === 6 || value === 9;
}

function correspondingPosition(position: number): number {
  return position <= 3 ? position + 3 : position - 3;
}

/**
 * Analyze one line's position.
 *
 * @param lineValuesBottomUp six line values, index 0 = line 1.
 * @param position 1-indexed, bottom-up.
 */
export function analyzeLinePosition(
  lineValuesBottomUp: readonly LineValue[],
  position: number,
): LinePositionAnalysis {
  const value = lineValuesBottomUp[position - 1];
  if (value === undefined) throw new Error(`LINE_POSITION_OUT_OF_RANGE: ${position}`);

  const polarity = polarityOf(value);
  const oddPlace = position % 2 === 1;
  const correctPlace = oddPlace ? polarity === "yang" : polarity === "yin";
  const central = position === 2 || position === 5;

  const partnerPosition = correspondingPosition(position);
  const partnerPolarity = polarityOf(lineValuesBottomUp[partnerPosition - 1]);

  const belowValue = position > 1 ? lineValuesBottomUp[position - 2] : undefined;
  const ridesYang = polarity === "yin"
    && belowValue !== undefined
    && polarityOf(belowValue) === "yang";

  return {
    position,
    polarity,
    moving: isMoving(value),
    correctPlace,
    central,
    centralAndCorrect: central && correctPlace,
    correspondence: { position: partnerPosition, responding: polarity !== partnerPolarity },
    ridesYang,
  };
}

export function analyzeAllLines(
  lineValuesBottomUp: readonly LineValue[],
): LinePositionAnalysis[] {
  return [1, 2, 3, 4, 5, 6].map((position) => analyzeLinePosition(lineValuesBottomUp, position));
}
