import { TRIGRAM_BITS, KING_WEN_HEXAGRAMS } from "@/domain/casting/hexagrams/king-wen";
import type { LineValue } from "@/domain/casting/types";
import type { PublicLineTuple } from "./types";

function assertLineValue(value: number): asserts value is LineValue {
  if (value !== 6 && value !== 7 && value !== 8 && value !== 9) {
    throw new Error(`MANUAL_INVALID_LINE_VALUE: ${value}`);
  }
}

function normalizeChangingLines(changingLines: readonly number[]): number[] {
  const normalized = [...changingLines].sort((left, right) => left - right);
  if (normalized.some((line) => !Number.isInteger(line) || line < 1 || line > 6)) {
    throw new Error("MANUAL_INVALID_CHANGING_LINE");
  }
  if (new Set(normalized).size !== normalized.length) throw new Error("MANUAL_DUPLICATE_CHANGING_LINE");
  return normalized;
}

export function manualFromLineValues(values: readonly number[]): PublicLineTuple {
  if (values.length !== 6) throw new Error("MANUAL_INVALID_LINE_COUNT");
  values.forEach(assertLineValue);
  return [
    values[0] as LineValue,
    values[1] as LineValue,
    values[2] as LineValue,
    values[3] as LineValue,
    values[4] as LineValue,
    values[5] as LineValue,
  ];
}

export function baseLineValuesForPrimaryHexagram(number: number): PublicLineTuple {
  const hexagram = KING_WEN_HEXAGRAMS[number - 1];
  if (!hexagram) throw new Error(`MANUAL_INVALID_PRIMARY_HEXAGRAM: ${number}`);
  const bits = (TRIGRAM_BITS[hexagram.upper] << 3) | TRIGRAM_BITS[hexagram.lower];
  const values = Array.from({ length: 6 }, (_, index) => (bits & (1 << index) ? 7 : 8));
  return [values[0]!, values[1]!, values[2]!, values[3]!, values[4]!, values[5]!];
}

export function manualFromPrimaryAndChangingLines(
  primaryHexagramNumber: number,
  changingLines: readonly number[],
): PublicLineTuple {
  const normalizedChangingLines = normalizeChangingLines(changingLines);
  const base = baseLineValuesForPrimaryHexagram(primaryHexagramNumber);
  const changingSet = new Set(normalizedChangingLines);
  const values = base.map((value, index) => {
    if (!changingSet.has(index + 1)) return value;
    return value === 7 ? 9 : 6;
  });
  return [values[0]!, values[1]!, values[2]!, values[3]!, values[4]!, values[5]!];
}

export function normalizeManualChangingLines(changingLines: readonly number[]): number[] {
  return normalizeChangingLines(changingLines);
}
