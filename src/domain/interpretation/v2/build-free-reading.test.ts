import { describe, expect, it } from "vitest";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import type { LineValue } from "@/domain/casting/types";
import { buildFreeReading } from "./build-free-reading";
import { loadHexagramInterpretation } from "./load-interpretation";

async function readingFor(lineValuesBottomUp: readonly LineValue[]) {
  const result = buildHexagramResult({ lineValuesBottomUp, method: "three_coin" });
  const primaryBundle = await loadHexagramInterpretation(result.primaryHexagramNumber);
  const relatingBundle = result.relatingHexagramNumber === null
    ? null
    : await loadHexagramInterpretation(result.relatingHexagramNumber);
  return { result, reading: buildFreeReading(result, primaryBundle, relatingBundle) };
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

describe("deterministic free reading composition", () => {
  it("uses the stable branch when no line moves", async () => {
    const { result, reading } = await readingFor([7, 7, 7, 7, 7, 7]);
    expect(result.primaryHexagramNumber).toBe(1);
    expect(result.movingLinePositions).toEqual([]);
    expect(result.relatingHexagramNumber).toBeNull();
    expect(reading.activeLines).toEqual([]);
    expect(reading.relating).toBeNull();
    expect(reading.relatingInterpretation).toBeNull();
    expect(reading.synthesis.whereChangeIsHappening).toContain("No changing lines were produced");
    expect(reading.synthesis.directionOfChange).toContain(reading.primaryInterpretation.stabilityTheme);
  });

  it("binds the exact single moving line to its line interpretation and relating hexagram", async () => {
    const { result, reading } = await readingFor([9, 7, 7, 7, 7, 7]);
    expect(result.primaryHexagramNumber).toBe(1);
    expect(result.movingLinePositions).toEqual([1]);
    expect(result.relatingHexagramNumber).toBe(44);
    expect(reading.activeLines).toHaveLength(1);
    expect(reading.activeLines[0]).toMatchObject({
      hexagramNumber: 1,
      position: 1,
      lineValue: 9,
      lineType: "Old yang",
      changeDirection: "yang → yin",
    });
    expect(reading.relating?.number).toBe(44);
    expect(reading.synthesis.whereChangeIsHappening).toContain(reading.activeLines[0].synthesisPhrase);
  });

  it("keeps every moving line in bottom-to-top order and synthesizes multiple changes", async () => {
    const { result, reading } = await readingFor([9, 6, 7, 9, 7, 7]);
    expect(result.primaryHexagramNumber).toBe(13);
    expect(result.movingLinePositions).toEqual([1, 2, 4]);
    expect(result.relatingHexagramNumber).toBe(57);
    expect(reading.activeLines.map((line) => line.position)).toEqual([1, 2, 4]);
    for (const line of reading.activeLines) {
      expect(reading.synthesis.whereChangeIsHappening).toContain(line.synthesisPhrase);
    }
    expect(reading.synthesis.whereChangeIsHappening).toContain("Several positions are changing at once");
    expect(reading.synthesis.directionOfChange).toContain(reading.primaryInterpretation.coreTheme);
    expect(reading.synthesis.directionOfChange).toContain(reading.relatingInterpretation?.coreTheme);
  });

  it("supports all six moving lines and derives the complete relating structure", async () => {
    const { result, reading } = await readingFor([9, 9, 9, 9, 9, 9]);
    expect(result.primaryHexagramNumber).toBe(1);
    expect(result.movingLinePositions).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.relatingHexagramNumber).toBe(2);
    expect(reading.activeLines.map((line) => line.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(reading.relating?.number).toBe(2);
  });

  it("produces a concise grounded bottom line without deterministic prophecy", async () => {
    const { reading } = await readingFor([9, 6, 7, 9, 7, 7]);
    expect(wordCount(reading.synthesis.bottomLine)).toBeGreaterThanOrEqual(50);
    expect(wordCount(reading.synthesis.bottomLine)).toBeLessThanOrEqual(100);
    const combined = Object.values(reading.synthesis).join(" ");
    expect(combined).not.toMatch(/\b(?:will happen|your future will|guarantees?)\b/i);
  });

  it("returns byte-for-byte equivalent reading content for the same six line values", async () => {
    const first = await readingFor([9, 6, 7, 9, 7, 7]);
    const second = await readingFor([9, 6, 7, 9, 7, 7]);
    expect(JSON.stringify(first.reading)).toBe(JSON.stringify(second.reading));
  });

  it("does not let interpretation alter casting facts", async () => {
    const { result, reading } = await readingFor([9, 7, 6, 7, 7, 7]);
    expect(result).toMatchObject({
      primaryHexagramNumber: 10,
      movingLinePositions: [1, 3],
      relatingHexagramNumber: 44,
    });
    expect(reading.result).toEqual(result);
  });
});
