import { describe, expect, it } from "vitest";
import { analyzeTiYong } from "./ti-yong";

describe("体用生克 (Ti-Yong analysis)", () => {
  it("treats the trigram holding the moving line as 用 and the quiet one as 体", () => {
    // Moving line 2 sits in the lower trigram, so the lower trigram is 用.
    const analysis = analyzeTiYong({ lower: "zhen", upper: "kun", movingLinePositions: [2] });

    expect(analysis?.yong.trigram).toBe("zhen");
    expect(analysis?.yong.position).toBe("inner");
    expect(analysis?.ti.trigram).toBe("kun");
    expect(analysis?.ti.position).toBe("outer");
  });

  it("reads 用生体 as favorable", () => {
    // 用 kan (water) generates 体 xun (wood).
    const analysis = analyzeTiYong({ lower: "kan", upper: "xun", movingLinePositions: [1] });

    expect(analysis?.relation).toBe("yong_generates_ti");
    expect(analysis?.direction).toBe("favorable");
  });

  it("reads 比和 as flowing", () => {
    // Both metal: qian and dui.
    const analysis = analyzeTiYong({ lower: "dui", upper: "qian", movingLinePositions: [2] });

    expect(analysis?.relation).toBe("harmonious");
    expect(analysis?.direction).toBe("flowing");
  });

  it("reads 体克用 as workable", () => {
    // 体 zhen (wood) overcomes 用 kun (earth).
    const analysis = analyzeTiYong({ lower: "kun", upper: "zhen", movingLinePositions: [3] });

    expect(analysis?.relation).toBe("ti_overcomes_yong");
    expect(analysis?.direction).toBe("workable");
  });

  it("reads 体生用 as draining", () => {
    // 体 li (fire) generates 用 gen (earth).
    const analysis = analyzeTiYong({ lower: "gen", upper: "li", movingLinePositions: [1] });

    expect(analysis?.relation).toBe("ti_generates_yong");
    expect(analysis?.direction).toBe("draining");
  });

  it("reads 用克体 as obstructed", () => {
    // 用 li (fire) overcomes 体 qian (metal).
    const analysis = analyzeTiYong({ lower: "qian", upper: "li", movingLinePositions: [5] });

    expect(analysis?.relation).toBe("yong_overcomes_ti");
    expect(analysis?.direction).toBe("obstructed");
  });

  // The classical precondition. Without it there is no basis for choosing a 体,
  // and inventing one would fabricate a direction the cast does not support.
  it("returns null when both trigrams contain moving lines", () => {
    expect(analyzeTiYong({ lower: "qian", upper: "kun", movingLinePositions: [2, 5] })).toBeNull();
  });

  it("returns null when no line moves", () => {
    expect(analyzeTiYong({ lower: "qian", upper: "kun", movingLinePositions: [] })).toBeNull();
  });

  it("returns null when all six lines move", () => {
    expect(
      analyzeTiYong({ lower: "qian", upper: "kun", movingLinePositions: [1, 2, 3, 4, 5, 6] }),
    ).toBeNull();
  });

  it("still resolves when several moving lines share one trigram", () => {
    const analysis = analyzeTiYong({ lower: "kan", upper: "xun", movingLinePositions: [1, 2, 3] });

    expect(analysis?.yong.trigram).toBe("kan");
    expect(analysis?.ti.trigram).toBe("xun");
  });
});
