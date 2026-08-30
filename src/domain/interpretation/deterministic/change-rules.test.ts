import { describe, expect, it } from "vitest";
import { selectOracleText } from "./change-rules";

// 朱熹《易学启蒙·考变占》七条. Each rule gets a case, including the two
// hexagrams that carry their own use-line text.
describe("变占规则 (Zhu Xi change rules)", () => {
  it("reads the primary judgment when no line moves", () => {
    const result = selectOracleText({ primaryHexagramNumber: 11, movingLinePositions: [] });

    expect(result.primary).toEqual({ kind: "judgment", hexagram: "primary" });
    expect(result.supporting).toEqual([]);
    expect(result.movingCount).toBe(0);
  });

  it("reads the moving line of the primary hexagram when one line moves", () => {
    const result = selectOracleText({ primaryHexagramNumber: 11, movingLinePositions: [3] });

    expect(result.primary).toEqual({ kind: "line", hexagram: "primary", position: 3 });
    expect(result.supporting).toEqual([{ kind: "judgment", hexagram: "primary" }]);
  });

  it("lets the upper moving line govern when two lines move", () => {
    const result = selectOracleText({ primaryHexagramNumber: 11, movingLinePositions: [5, 2] });

    expect(result.primary).toEqual({ kind: "line", hexagram: "primary", position: 5 });
    expect(result.supporting).toEqual([{ kind: "line", hexagram: "primary", position: 2 }]);
  });

  it("reads both judgments with the primary governing when three lines move", () => {
    const result = selectOracleText({ primaryHexagramNumber: 11, movingLinePositions: [1, 3, 5] });

    expect(result.primary).toEqual({ kind: "judgment", hexagram: "primary" });
    expect(result.supporting).toEqual([{ kind: "judgment", hexagram: "relating" }]);
  });

  it("reads the lower quiet line of the relating hexagram when four lines move", () => {
    const result = selectOracleText({ primaryHexagramNumber: 11, movingLinePositions: [1, 2, 4, 6] });

    // Quiet lines are 3 and 5; the lower governs.
    expect(result.primary).toEqual({ kind: "line", hexagram: "relating", position: 3 });
    expect(result.supporting).toEqual([{ kind: "line", hexagram: "relating", position: 5 }]);
  });

  it("reads the single quiet line of the relating hexagram when five lines move", () => {
    const result = selectOracleText({ primaryHexagramNumber: 11, movingLinePositions: [1, 2, 3, 4, 6] });

    expect(result.primary).toEqual({ kind: "line", hexagram: "relating", position: 5 });
    expect(result.supporting).toEqual([]);
  });

  it("reads 用九 when all six lines of Qian move", () => {
    const result = selectOracleText({ primaryHexagramNumber: 1, movingLinePositions: [1, 2, 3, 4, 5, 6] });

    expect(result.primary).toEqual({ kind: "use_line", hexagram: "primary", label: "用九" });
  });

  it("reads 用六 when all six lines of Kun move", () => {
    const result = selectOracleText({ primaryHexagramNumber: 2, movingLinePositions: [1, 2, 3, 4, 5, 6] });

    expect(result.primary).toEqual({ kind: "use_line", hexagram: "primary", label: "用六" });
  });

  it("reads the relating judgment when all six lines of any other hexagram move", () => {
    const result = selectOracleText({ primaryHexagramNumber: 11, movingLinePositions: [1, 2, 3, 4, 5, 6] });

    expect(result.primary).toEqual({ kind: "judgment", hexagram: "relating" });
    expect(result.supporting).toEqual([{ kind: "judgment", hexagram: "primary" }]);
  });

  it("is independent of the order moving positions arrive in", () => {
    const ascending = selectOracleText({ primaryHexagramNumber: 11, movingLinePositions: [2, 4, 6, 1] });
    const shuffled = selectOracleText({ primaryHexagramNumber: 11, movingLinePositions: [6, 1, 4, 2] });

    expect(shuffled).toEqual(ascending);
  });

  it("identifies the applied classical rule for every moving count", () => {
    for (let count = 0; count <= 6; count += 1) {
      const positions = [1, 2, 3, 4, 5, 6].slice(0, count);
      const result = selectOracleText({ primaryHexagramNumber: 11, movingLinePositions: positions });

      expect(result.ruleId.length).toBeGreaterThan(0);
      expect(result.movingCount).toBe(count);
    }
  });
});
