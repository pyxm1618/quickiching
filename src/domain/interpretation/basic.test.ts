import { describe, expect, it } from "vitest";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { BASIC_HEXAGRAM_INTERPRETATIONS, buildBasicReading, getBasicInterpretation } from "./basic";

describe("Public V1 basic interpretations", () => {
  it("covers all 64 King Wen numbers with useful original summaries", () => {
    expect(Object.keys(BASIC_HEXAGRAM_INTERPRETATIONS)).toHaveLength(64);
    for (let number = 1; number <= 64; number += 1) {
      const interpretation = getBasicInterpretation(number);
      expect(interpretation.theme.length).toBeGreaterThan(3);
      expect(interpretation.summary.length).toBeGreaterThan(80);
    }
  });

  it("explains moving structure and relating interpretation without personal context", () => {
    const result = buildHexagramResult({ lineValuesBottomUp: [9, 7, 7, 7, 7, 7], method: "three_coin" });
    const reading = buildBasicReading(result);
    expect(reading.primary.number).toBe(1);
    expect(reading.relating?.number).toBe(44);
    expect(reading.changeExplanation).toContain("Changing line 1");
    expect(reading.primaryInterpretation.summary).toBeTruthy();
    expect(reading.relatingInterpretation?.summary).toBeTruthy();
  });

  it("does not invent a relating hexagram when no line moves", () => {
    const result = buildHexagramResult({ lineValuesBottomUp: [7, 7, 7, 7, 7, 7], method: "three_coin" });
    const reading = buildBasicReading(result);
    expect(reading.relating).toBeNull();
    expect(reading.relatingInterpretation).toBeNull();
    expect(reading.changeExplanation).toContain("No changing lines");
  });
});
