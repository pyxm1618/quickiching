import type { HexagramResult, LineValue } from "@/domain/casting/types";
import {
  BINARY_TO_KING_WEN,
  hexagramByNumber,
  TRIGRAM_BITS,
  type Trigram,
} from "@/domain/casting/hexagrams/king-wen";
import {
  classicalHexagramByNumber,
  type ClassicalSource,
} from "@/domain/public-reading/classical";
import { selectOracleText, type ChangeRuleResult, type OracleTextRef } from "./change-rules";
import { analyzeLinePosition, type LinePositionAnalysis } from "./line-position";
import { analyzeTiYong, type TiYongAnalysis, type VerdictDirection } from "./ti-yong";
import { TRIGRAM_ATTRIBUTES, type TrigramAttributes } from "./trigrams";

// Assembles the deterministic half of a deep reading. Everything returned here
// is derived from the cast by classical rule, never by a language model, and is
// rendered to the reader as-is. The model receives it as fixed input.

export type ResolvedOracleText = {
  ref: OracleTextRef;
  hexagramNumber: number;
  hexagramChineseName: string;
  hexagramEnglishName: string;
  label: string;
  text: string;
  source: ClassicalSource;
};

export type TrigramView = TrigramAttributes & { role: "inner" | "outer" };

export type DeterministicVerdict = {
  primaryHexagram: { number: number; chineseName: string; englishName: string };
  relatingHexagram: { number: number; chineseName: string; englishName: string } | null;
  nuclearHexagram: { number: number; chineseName: string; englishName: string };
  movingLinePositions: readonly number[];
  changeRule: ChangeRuleResult;
  oracle: { primary: ResolvedOracleText; supporting: ResolvedOracleText[] };
  tiYong: TiYongAnalysis | null;
  // Null when Ti-Yong does not apply; the reading then rests on the change rule
  // and line structure without asserting a direction.
  direction: VerdictDirection | null;
  movingLines: LinePositionAnalysis[];
  trigrams: { inner: TrigramView; outer: TrigramView };
};

function lineToBit(value: LineValue): 0 | 1 {
  // Old yin (6) is yin now, old yang (9) is yang now.
  return value === 7 || value === 9 ? 1 : 0;
}

function bitsToNumber(bits: readonly (0 | 1)[]): number {
  let binary = 0;
  for (let index = 0; index < 6; index += 1) binary |= bits[index] << index;
  const number = BINARY_TO_KING_WEN.get(binary);
  if (number === undefined) throw new Error(`HEXAGRAM_MAPPING_MISSING_FOR_BITS: ${binary}`);
  return number;
}

function trigramFromBits(bits: readonly (0 | 1)[]): Trigram {
  const value = bits[0] | (bits[1] << 1) | (bits[2] << 2);
  const found = (Object.keys(TRIGRAM_BITS) as Trigram[]).find(
    (trigram) => TRIGRAM_BITS[trigram] === value,
  );
  if (!found) throw new Error(`TRIGRAM_MAPPING_MISSING_FOR_BITS: ${value}`);
  return found;
}

function relatingBits(lineValuesBottomUp: readonly LineValue[]): (0 | 1)[] {
  return lineValuesBottomUp.map((value) => {
    const bit = lineToBit(value);
    // Only old yin and old yang change into their opposite.
    return value === 6 || value === 9 ? ((bit === 1 ? 0 : 1) as 0 | 1) : bit;
  });
}

// 互卦 — lines 2-3-4 form the inner trigram, 3-4-5 the outer.
function nuclearNumber(lineValuesBottomUp: readonly LineValue[]): number {
  const bits = lineValuesBottomUp.map(lineToBit);
  const nuclear: (0 | 1)[] = [bits[1], bits[2], bits[3], bits[2], bits[3], bits[4]];
  return bitsToNumber(nuclear);
}

function named(number: number) {
  const def = hexagramByNumber(number);
  return { number, chineseName: def.chineseName, englishName: def.englishName };
}

function resolveOracleText(
  ref: OracleTextRef,
  hexagramNumbers: { primary: number; relating: number | null },
): ResolvedOracleText {
  const targetNumber = ref.hexagram === "primary" ? hexagramNumbers.primary : hexagramNumbers.relating;
  if (targetNumber === null) throw new Error("RELATING_HEXAGRAM_REQUIRED_BY_CHANGE_RULE");

  const classical = classicalHexagramByNumber(targetNumber);
  const base = {
    ref,
    hexagramNumber: targetNumber,
    hexagramChineseName: classical.chineseName,
    hexagramEnglishName: classical.englishName,
    source: classical.source,
  };

  if (ref.kind === "judgment") {
    return { ...base, label: `${classical.chineseName}·卦辞`, text: classical.judgment };
  }
  if (ref.kind === "use_line") {
    const useLine = classical.useLine;
    if (!useLine) throw new Error(`USE_LINE_UNAVAILABLE: ${targetNumber}`);
    return { ...base, label: useLine.label, text: useLine.text, source: useLine.source };
  }
  const line = classical.lines[ref.position - 1];
  if (!line) throw new Error(`LINE_TEXT_UNAVAILABLE: ${targetNumber}:${ref.position}`);
  return { ...base, label: line.label, text: line.text, source: line.source };
}

/**
 * Build the deterministic verdict for a completed cast.
 *
 * The caller supplies an already-verified HexagramResult; this function never
 * recomputes the cast, only reads structure out of it.
 */
export function buildDeterministicVerdict(result: HexagramResult): DeterministicVerdict {
  const lineValues = result.lineValuesBottomUp;
  const primaryNumber = result.primaryHexagramNumber;
  const relatingNumber = result.relatingHexagramNumber;

  const changeRule = selectOracleText({
    primaryHexagramNumber: primaryNumber,
    movingLinePositions: result.movingLinePositions,
  });

  const hexagramNumbers = { primary: primaryNumber, relating: relatingNumber };
  const oracle = {
    primary: resolveOracleText(changeRule.primary, hexagramNumbers),
    supporting: changeRule.supporting.map((ref) => resolveOracleText(ref, hexagramNumbers)),
  };

  const primaryDef = hexagramByNumber(primaryNumber);
  const tiYong = analyzeTiYong({
    lower: primaryDef.lower,
    upper: primaryDef.upper,
    movingLinePositions: result.movingLinePositions,
  });

  return {
    primaryHexagram: named(primaryNumber),
    relatingHexagram: relatingNumber === null ? null : named(relatingNumber),
    nuclearHexagram: named(nuclearNumber(lineValues)),
    movingLinePositions: result.movingLinePositions,
    changeRule,
    oracle,
    tiYong,
    direction: tiYong?.direction ?? null,
    movingLines: result.movingLinePositions.map((position) =>
      analyzeLinePosition(lineValues, position),
    ),
    trigrams: {
      inner: { ...TRIGRAM_ATTRIBUTES[primaryDef.lower], role: "inner" },
      outer: { ...TRIGRAM_ATTRIBUTES[primaryDef.upper], role: "outer" },
    },
  };
}

// Exported for the relating-hexagram checks the workflow performs before
// persisting a reading.
export function relatingHexagramNumber(lineValuesBottomUp: readonly LineValue[]): number | null {
  const hasMoving = lineValuesBottomUp.some((value) => value === 6 || value === 9);
  if (!hasMoving) return null;
  return bitsToNumber(relatingBits(lineValuesBottomUp));
}

export function innerOuterTrigrams(hexagramNumber: number): { inner: Trigram; outer: Trigram } {
  const def = hexagramByNumber(hexagramNumber);
  return { inner: def.lower, outer: def.upper };
}

export { trigramFromBits };
