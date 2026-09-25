import { describe, expect, it } from "vitest";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import type { DeterministicFacts } from "@/domain/generation/schemas";
import { deepReadingVariantPolicy } from "@/domain/generation/deep-reading-contract";
import { buildDeepReadingKnowledgeBundle } from "./deep-reading-knowledge";

function facts(lines: [6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9]): DeterministicFacts {
  const result = buildHexagramResult({ lineValuesBottomUp: lines, method: "three_coin", algorithmVersion: "three-coin-v1" });
  const variant = result.movingLinePositions.length === 0
    ? "still_hexagram"
    : result.movingLinePositions.length === 6
      ? "all_lines_moving"
      : result.movingLinePositions.length > 1
        ? "multiple_moving"
        : "standard";
  return {
    method: "three_coin",
    algorithmVersion: result.algorithmVersion,
    classicMappingVersion: result.classicMappingVersion,
    lineValuesBottomUp: [...result.lineValuesBottomUp] as DeterministicFacts["lineValuesBottomUp"],
    primaryHexagramNumber: result.primaryHexagramNumber,
    movingLinePositions: [...result.movingLinePositions],
    relatingHexagramNumber: result.relatingHexagramNumber,
    readingVariant: variant,
  };
}

describe("Deep Reading knowledge bundle", () => {
  it("keeps a still cast stable and omits line/relating evidence", async () => {
    const knowledge = await buildDeepReadingKnowledgeBundle(facts([7, 7, 8, 8, 7, 8]));
    expect(knowledge.changingLines).toEqual([]);
    expect(knowledge.relating).toBeNull();
    expect(knowledge.structuralChange).toContain("No lines change");
    expect(deepReadingVariantPolicy("still_hexagram")).toContain("Do not claim");
  });

  it("includes the single moving line's classical text and authored interpretation", async () => {
    const castFacts = facts([7, 7, 9, 8, 7, 8]);
    const knowledge = await buildDeepReadingKnowledgeBundle(castFacts);
    expect(knowledge.changingLines).toHaveLength(1);
    expect(knowledge.changingLines[0]?.position).toBe(castFacts.movingLinePositions[0]);
    expect(knowledge.changingLines[0]?.classicalText).toBeTruthy();
    expect(knowledge.evidence.some((item) => item.id.endsWith(".classical"))).toBe(true);
  });

  it("keeps each active line and states the local multiple-line synthesis policy", async () => {
    const castFacts = facts([9, 7, 9, 8, 7, 8]);
    const knowledge = await buildDeepReadingKnowledgeBundle(castFacts);
    expect(knowledge.changingLines.map((line) => line.position)).toEqual(castFacts.movingLinePositions);
    expect(knowledge.structuralChange).toContain("2 changing lines");
    expect(deepReadingVariantPolicy("multiple_moving")).toContain("Synthesize the active lines together");
  });

  it("uses the explicit all-lines-moving policy with the full primary/relating contrast", async () => {
    const castFacts = facts([6, 9, 6, 9, 6, 9]);
    const knowledge = await buildDeepReadingKnowledgeBundle(castFacts);
    expect(castFacts.readingVariant).toBe("all_lines_moving");
    expect(knowledge.changingLines).toHaveLength(6);
    expect(knowledge.relating).not.toBeNull();
    expect(deepReadingVariantPolicy("all_lines_moving")).toContain("special all-lines-moving contrast");
  });
});
