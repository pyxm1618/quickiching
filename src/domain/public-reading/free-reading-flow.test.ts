import { describe, expect, it } from "vitest";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { meiHuaFromFields } from "@/domain/casting/mei-hua/algorithm";
import { generateThreeCoinLine } from "@/domain/casting/three-coin/algorithm";
import { generateYarrowLine } from "@/domain/casting/yarrow/algorithm";
import { buildBasicReading } from "@/domain/interpretation/basic";

function seededRandomInt(seedStart: number) {
  let seed = seedStart;
  return (maxExclusive: number) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed % maxExclusive;
  };
}

describe("Public V1 free reading integration", () => {
  it("completes Three Coin from six sealed lines through free interpretation", () => {
    const bits = [true, true, true, false, false, false, true, false, true, false, true, false, true, true, false, false, true, true];
    let bitIndex = 0;
    const lines = [0, 1, 2, 3, 4, 5].map((lineIndex) => generateThreeCoinLine(lineIndex as 0 | 1 | 2 | 3 | 4 | 5, () => bits[bitIndex++]).lineValue);
    const result = buildHexagramResult({ lineValuesBottomUp: lines, method: "three_coin" });
    const reading = buildBasicReading(result);
    expect(result.lineValuesBottomUp).toHaveLength(6);
    expect(result.primaryHexagramNumber).toBeGreaterThanOrEqual(1);
    expect(reading.primaryInterpretation.summary.length).toBeGreaterThan(80);
    if (result.relatingHexagramNumber) expect(reading.relatingInterpretation).not.toBeNull();
  });

  it("completes 18 Yarrow changes through the shared result and free interpretation", () => {
    const randomInt = seededRandomInt(42);
    const lines = [0, 1, 2, 3, 4, 5].map((lineIndex) => {
      const line = generateYarrowLine(lineIndex as 0 | 1 | 2 | 3 | 4 | 5, randomInt);
      expect(line.changes).toHaveLength(3);
      return line.lineValue;
    });
    const result = buildHexagramResult({ lineValuesBottomUp: lines, method: "yarrow_stalk" });
    const reading = buildBasicReading(result);
    expect(result.lineValuesBottomUp).toHaveLength(6);
    expect(reading.primary.number).toBe(result.primaryHexagramNumber);
    expect(reading.primaryInterpretation.summary).toBeTruthy();
  });

  it("completes Mei Hua current-time through primary, one moving line, relating and free interpretation", () => {
    const meiHua = meiHuaFromFields({ year: 2026, month: 8, day: 10, hour: 14, ianaTimeZone: "Asia/Singapore" });
    const result = buildHexagramResult({ lineValuesBottomUp: meiHua.lineValuesBottomUp, method: "mei_hua_current_time", algorithmVersion: meiHua.algorithmVersion });
    const reading = buildBasicReading(result);
    expect(result.movingLinePositions).toHaveLength(1);
    expect(result.relatingHexagramNumber).not.toBeNull();
    expect(reading.primaryInterpretation.summary).toBeTruthy();
    expect(reading.relatingInterpretation?.summary).toBeTruthy();
  });
});
