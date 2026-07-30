import {
  BINARY_TO_KING_WEN,
  hexagramByNumber,
} from "./king-wen";
import {
  ALGORITHM_VERSIONS,
  CLASSIC_MAPPING_VERSION,
  type CastingMethod,
  type HexagramResult,
  type LineValue,
} from "../types";

// A line value of 6 (old yin) or 9 (old yang) is a moving line.
export function isMovingLine(value: LineValue): boolean {
  return value === 6 || value === 9;
}

// yang line => bit 1, yin line => bit 0
function lineToBit(value: LineValue): number {
  return value === 7 || value === 9 ? 1 : 0;
}

function bitsToNumber(bits: readonly number[]): number {
  let b = 0;
  for (let i = 0; i < 6; i++) {
    b |= (bits[i] & 1) << i;
  }
  const kw = BINARY_TO_KING_WEN.get(b);
  if (kw === undefined) throw new Error(`HEXAGRAM_MAPPING_MISSING bits=${b}`);
  return kw;
}

export type BuildResultInput = {
  lineValuesBottomUp: readonly LineValue[];
  method: CastingMethod;
  algorithmVersion?: string;
};

// Pure, deterministic computation of the unified HexagramResult from six line values.
export function buildHexagramResult(input: BuildResultInput): HexagramResult {
  const { lineValuesBottomUp, method } = input;
  if (lineValuesBottomUp.length !== 6) {
    throw new Error("CAST_INVALID_LINE_COUNT");
  }

  const primaryBits = lineValuesBottomUp.map(lineToBit);
  const primaryNumber = bitsToNumber(primaryBits);

  const movingLinePositions: number[] = [];
  for (let i = 0; i < 6; i++) {
    if (isMovingLine(lineValuesBottomUp[i])) movingLinePositions.push(i + 1);
  }
  movingLinePositions.sort((a, b) => a - b);

  let relatingNumber: number | null = null;
  if (movingLinePositions.length > 0) {
    const relatingBits = primaryBits.slice();
    for (const pos of movingLinePositions) {
      relatingBits[pos - 1] = primaryBits[pos - 1] === 1 ? 0 : 1;
    }
    relatingNumber = bitsToNumber(relatingBits);
  }

  return {
    lineValuesBottomUp: lineValuesBottomUp as HexagramResult["lineValuesBottomUp"],
    primaryHexagramNumber: primaryNumber,
    movingLinePositions,
    relatingHexagramNumber: relatingNumber,
    method,
    algorithmVersion: input.algorithmVersion ?? ALGORITHM_VERSIONS[method],
    classicMappingVersion: CLASSIC_MAPPING_VERSION,
  };
}

export function primaryHexagramName(number: number): string {
  return hexagramByNumber(number).englishName;
}

// Returns the Unicode-line description used by the UI (☯-free plain text).
export function lineStructureDescription(result: HexagramResult): string {
  return result.lineValuesBottomUp
    .map((v, i) => {
      const pos = i + 1;
      const yin = v === 6 || v === 8;
      const moving = isMovingLine(v);
      const base = yin ? "Yin" : "Yang";
      return `Line ${pos}: ${base}${moving ? " (moving)" : ""}`;
    })
    .join(" · ");
}
