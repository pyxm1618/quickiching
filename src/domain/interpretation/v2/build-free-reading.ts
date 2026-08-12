import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import type { HexagramResult } from "@/domain/casting/types";
import { buildReadingSynthesis } from "./build-reading-synthesis";
import {
  isMovingLineValue,
  type ActiveLineInterpretation,
  type FreeReading,
  type HexagramInterpretationBundle,
  type LinePosition,
} from "./types";

function assertBundleNumber(bundle: HexagramInterpretationBundle, expectedNumber: number): void {
  if (bundle.hexagram.number !== expectedNumber) {
    throw new Error(`HEXAGRAM_INTERPRETATION_MISMATCH: expected=${expectedNumber} actual=${bundle.hexagram.number}`);
  }
}

function activeLineInterpretations(
  result: HexagramResult,
  primaryBundle: HexagramInterpretationBundle,
): readonly ActiveLineInterpretation[] {
  return result.movingLinePositions.map((positionNumber) => {
    const position = positionNumber as LinePosition;
    const lineValue = result.lineValuesBottomUp[position - 1];
    if (!isMovingLineValue(lineValue)) {
      throw new Error(`MOVING_LINE_VALUE_MISMATCH: position=${position} value=${lineValue}`);
    }
    const interpretation = primaryBundle.lines[position - 1];
    if (!interpretation || interpretation.position !== position) {
      throw new Error(`LINE_INTERPRETATION_MISSING: hexagramNumber=${result.primaryHexagramNumber} position=${position}`);
    }
    return {
      ...interpretation,
      lineValue,
      lineType: lineValue === 6 ? "Old yin" : "Old yang",
      changeDirection: lineValue === 6 ? "yin → yang" : "yang → yin",
    };
  });
}

export function buildFreeReading(
  result: HexagramResult,
  primaryBundle: HexagramInterpretationBundle,
  relatingBundle: HexagramInterpretationBundle | null,
): FreeReading {
  assertBundleNumber(primaryBundle, result.primaryHexagramNumber);

  if (result.relatingHexagramNumber === null && relatingBundle !== null) {
    throw new Error("RELATING_INTERPRETATION_UNEXPECTED");
  }
  if (result.relatingHexagramNumber !== null && relatingBundle === null) {
    throw new Error(`HEXAGRAM_INTERPRETATION_MISSING: number=${result.relatingHexagramNumber}`);
  }
  if (result.relatingHexagramNumber !== null && relatingBundle !== null) {
    assertBundleNumber(relatingBundle, result.relatingHexagramNumber);
  }

  const primary = hexagramByNumber(result.primaryHexagramNumber);
  const activeLines = activeLineInterpretations(result, primaryBundle);
  const relating = result.relatingHexagramNumber === null
    ? null
    : hexagramByNumber(result.relatingHexagramNumber);
  const relatingInterpretation = relatingBundle?.hexagram ?? null;
  const synthesis = buildReadingSynthesis({
    primary: primaryBundle.hexagram,
    activeLines,
    relating: relatingInterpretation,
  });

  return {
    result,
    primary,
    primaryInterpretation: primaryBundle.hexagram,
    activeLines,
    relating,
    relatingInterpretation,
    synthesis,
  };
}
