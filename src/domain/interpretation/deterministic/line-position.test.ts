import { describe, expect, it } from "vitest";
import type { LineValue } from "@/domain/casting/types";
import { analyzeAllLines, analyzeLinePosition, polarityOf } from "./line-position";

// 既济 (63): yang in 1/3/5, yin in 2/4/6 — every line correctly placed.
const JI_JI: readonly LineValue[] = [7, 8, 7, 8, 7, 8];
// 未济 (64): the exact inverse — no line correctly placed.
const WEI_JI: readonly LineValue[] = [8, 7, 8, 7, 8, 7];

describe("爻位 (line position analysis)", () => {
  it("reads 6 and 9 as moving, 7 and 8 as quiet", () => {
    const values: readonly LineValue[] = [6, 7, 8, 9, 7, 8];
    const lines = analyzeAllLines(values);

    expect(lines.map((line) => line.moving)).toEqual([true, false, false, true, false, false]);
  });

  it("reads old yin as yin and old yang as yang", () => {
    expect(polarityOf(6)).toBe("yin");
    expect(polarityOf(9)).toBe("yang");
    expect(polarityOf(7)).toBe("yang");
    expect(polarityOf(8)).toBe("yin");
  });

  it("marks every line of 既济 as correctly placed", () => {
    expect(analyzeAllLines(JI_JI).every((line) => line.correctPlace)).toBe(true);
  });

  it("marks no line of 未济 as correctly placed", () => {
    expect(analyzeAllLines(WEI_JI).some((line) => line.correctPlace)).toBe(false);
  });

  it("treats only the second and fifth places as central", () => {
    expect(analyzeAllLines(JI_JI).map((line) => line.central)).toEqual([
      false, true, false, false, true, false,
    ]);
  });

  it("recognises 中正 at 六二 and 九五", () => {
    const lines = analyzeAllLines(JI_JI);

    expect(lines[1].centralAndCorrect).toBe(true);
    expect(lines[4].centralAndCorrect).toBe(true);
    expect(lines[0].centralAndCorrect).toBe(false);
  });

  it("pairs 1-4, 2-5 and 3-6 and reports response when polarities differ", () => {
    const lines = analyzeAllLines(JI_JI);

    expect(lines.map((line) => line.correspondence.position)).toEqual([4, 5, 6, 1, 2, 3]);
    // 既济 alternates polarity, so every pair responds.
    expect(lines.every((line) => line.correspondence.responding)).toBe(true);
  });

  it("reports no response when a pair shares polarity", () => {
    const allYang: readonly LineValue[] = [7, 7, 7, 7, 7, 7];

    expect(analyzeAllLines(allYang).some((line) => line.correspondence.responding)).toBe(false);
  });

  it("detects 乘刚 when a yin line sits directly above a yang line", () => {
    const lines = analyzeAllLines(JI_JI);

    // Line 2 is yin over the yang line 1.
    expect(lines[1].ridesYang).toBe(true);
    // Line 1 has nothing beneath it.
    expect(lines[0].ridesYang).toBe(false);
  });

  // Position imagery is presentation and lives in localize.ts, so the analysis
  // itself stays language-neutral.
  it("returns no localized prose from the analysis", () => {
    for (const line of analyzeAllLines(JI_JI)) {
      expect(line).not.toHaveProperty("imagery");
    }
  });

  it("rejects a position outside 1..6", () => {
    expect(() => analyzeLinePosition(JI_JI, 7)).toThrow("LINE_POSITION_OUT_OF_RANGE");
    expect(() => analyzeLinePosition(JI_JI, 0)).toThrow("LINE_POSITION_OUT_OF_RANGE");
  });
});
