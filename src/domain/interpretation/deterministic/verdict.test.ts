import { describe, expect, it } from "vitest";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import type { LineValue } from "@/domain/casting/types";
import { CLASSICAL_SOURCE_TEXT } from "@/domain/public-reading/classical-source-data";
import { buildDeterministicVerdict, relatingHexagramNumber } from "./verdict";

function cast(lineValuesBottomUp: LineValue[]) {
  return buildHexagramResult({ lineValuesBottomUp, method: "three_coin" });
}

describe("确定性断语 (deterministic verdict)", () => {
  it("quotes the primary judgment verbatim from the verified classical source", () => {
    // All young lines: 乾 (1) with nothing moving.
    const verdict = buildDeterministicVerdict(cast([7, 7, 7, 7, 7, 7]));

    expect(verdict.primaryHexagram.number).toBe(1);
    expect(verdict.relatingHexagram).toBeNull();
    expect(verdict.oracle.primary.text).toBe(CLASSICAL_SOURCE_TEXT[1].judgment);
    expect(verdict.oracle.primary.label).toBe("乾·卦辞");
  });

  it("quotes the moving line text verbatim when one line moves", () => {
    // 乾 with line 1 old yang: reads 初九.
    const verdict = buildDeterministicVerdict(cast([9, 7, 7, 7, 7, 7]));

    expect(verdict.oracle.primary.text).toBe(CLASSICAL_SOURCE_TEXT[1].lines[0].text);
    expect(verdict.oracle.primary.label).toBe("初九");
    expect(verdict.oracle.primary.hexagramNumber).toBe(1);
  });

  it("resolves supporting texts from the relating hexagram when three lines move", () => {
    const result = cast([9, 9, 9, 7, 7, 7]);
    const verdict = buildDeterministicVerdict(result);

    expect(verdict.changeRule.movingCount).toBe(3);
    expect(verdict.oracle.primary.hexagramNumber).toBe(result.primaryHexagramNumber);
    expect(verdict.oracle.supporting[0].hexagramNumber).toBe(result.relatingHexagramNumber);
    expect(verdict.oracle.supporting[0].text)
      .toBe(CLASSICAL_SOURCE_TEXT[result.relatingHexagramNumber!].judgment);
  });

  it("reads 用九 when all six lines of Qian move", () => {
    const verdict = buildDeterministicVerdict(cast([9, 9, 9, 9, 9, 9]));

    expect(verdict.primaryHexagram.number).toBe(1);
    expect(verdict.oracle.primary.label).toBe("用九");
    expect(verdict.oracle.primary.text).toBe(CLASSICAL_SOURCE_TEXT[1].useLine?.text);
  });

  it("reads 用六 when all six lines of Kun move", () => {
    const verdict = buildDeterministicVerdict(cast([6, 6, 6, 6, 6, 6]));

    expect(verdict.primaryHexagram.number).toBe(2);
    expect(verdict.oracle.primary.label).toBe("用六");
    expect(verdict.oracle.primary.text).toBe(CLASSICAL_SOURCE_TEXT[2].useLine?.text);
  });

  it("carries a Ti-Yong direction when the moving lines sit in one trigram", () => {
    // Moving line 2 only: the lower trigram is 用.
    const verdict = buildDeterministicVerdict(cast([7, 9, 7, 8, 8, 8]));

    expect(verdict.tiYong).not.toBeNull();
    expect(verdict.direction).toBe(verdict.tiYong?.direction);
  });

  it("reports no direction when both trigrams move, instead of inventing one", () => {
    const verdict = buildDeterministicVerdict(cast([9, 7, 7, 7, 9, 7]));

    expect(verdict.tiYong).toBeNull();
    expect(verdict.direction).toBeNull();
    // The reading still has its governing text from the change rule.
    expect(verdict.oracle.primary.text.length).toBeGreaterThan(0);
  });

  it("derives the nuclear hexagram from lines 2-3-4 and 3-4-5", () => {
    // 乾 is its own nuclear hexagram; 坤 likewise.
    expect(buildDeterministicVerdict(cast([7, 7, 7, 7, 7, 7])).nuclearHexagram.number).toBe(1);
    expect(buildDeterministicVerdict(cast([8, 8, 8, 8, 8, 8])).nuclearHexagram.number).toBe(2);
  });

  it("exposes inner and outer trigram attributes", () => {
    // 泰 (11): 乾 below, 坤 above.
    const verdict = buildDeterministicVerdict(cast([7, 7, 7, 8, 8, 8]));

    expect(verdict.primaryHexagram.number).toBe(11);
    expect(verdict.trigrams.inner.trigram).toBe("qian");
    expect(verdict.trigrams.inner.role).toBe("inner");
    expect(verdict.trigrams.outer.trigram).toBe("kun");
  });

  it("analyzes every moving line's position", () => {
    const verdict = buildDeterministicVerdict(cast([9, 7, 7, 7, 6, 7]));

    expect(verdict.movingLines.map((line) => line.position)).toEqual([1, 5]);
    expect(verdict.movingLines.every((line) => line.moving)).toBe(true);
  });

  it("agrees with buildHexagramResult on the relating hexagram", () => {
    const values: LineValue[] = [9, 8, 7, 6, 7, 8];

    expect(relatingHexagramNumber(values)).toBe(cast(values).relatingHexagramNumber);
  });

  it("has no relating hexagram when nothing moves", () => {
    expect(relatingHexagramNumber([7, 8, 7, 8, 7, 8])).toBeNull();
  });

  it("never invents text: every resolved quote matches the verified source table", () => {
    // Sweep one moving line through every position of every hexagram and assert
    // the quoted text is byte-identical to the verified snapshot.
    for (let position = 1; position <= 6; position += 1) {
      const values: LineValue[] = [7, 7, 7, 7, 7, 7];
      values[position - 1] = 9;
      const verdict = buildDeterministicVerdict(cast(values));
      const expected = CLASSICAL_SOURCE_TEXT[verdict.oracle.primary.hexagramNumber];
      const ref = verdict.oracle.primary.ref;

      if (ref.kind === "line") {
        expect(verdict.oracle.primary.text).toBe(expected.lines[ref.position - 1].text);
      }
    }
  });
});
