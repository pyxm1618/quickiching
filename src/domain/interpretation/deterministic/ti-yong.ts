import type { Trigram } from "@/domain/casting/hexagrams/king-wen";
import { generates, overcomes, trigramPhase, type FivePhase } from "./trigrams";

// 体用 (Mei Hua Yi Shu). The trigram containing the moving line is 用 — the
// matter asked about. The quiet trigram is 体 — the querent. Their five-phase
// relation gives the direction of the answer.
//
// This is the classical mechanism that binds a question to a cast, which is why
// the verdict direction is computed here rather than left to a language model.

export type TiYongRelation =
  | "yong_generates_ti"
  | "harmonious"
  | "ti_overcomes_yong"
  | "ti_generates_yong"
  | "yong_overcomes_ti";

export type VerdictDirection =
  | "favorable"
  | "flowing"
  | "workable"
  | "draining"
  | "obstructed";

export type TiYongAnalysis = {
  ti: { trigram: Trigram; position: "inner" | "outer"; phase: FivePhase };
  yong: { trigram: Trigram; position: "inner" | "outer"; phase: FivePhase };
  relation: TiYongRelation;
  direction: VerdictDirection;
};

const RELATION_DIRECTION: Readonly<Record<TiYongRelation, VerdictDirection>> = Object.freeze({
  yong_generates_ti: "favorable",
  harmonious: "flowing",
  ti_overcomes_yong: "workable",
  ti_generates_yong: "draining",
  yong_overcomes_ti: "obstructed",
});

function relationOf(tiPhase: FivePhase, yongPhase: FivePhase): TiYongRelation {
  if (generates(yongPhase, tiPhase)) return "yong_generates_ti";
  if (overcomes(tiPhase, yongPhase)) return "ti_overcomes_yong";
  if (generates(tiPhase, yongPhase)) return "ti_generates_yong";
  if (overcomes(yongPhase, tiPhase)) return "yong_overcomes_ti";
  return "harmonious";
}

/**
 * Ti-Yong analysis for a cast, or null when the classical precondition fails.
 *
 * The method requires the moving lines to fall inside exactly one trigram. A
 * three-coin cast can move lines in both trigrams (or none), and there is no
 * classical basis for choosing a 体 in that case. Returning null there is
 * deliberate: the caller falls back to the change rules, line position and
 * inner/outer reading rather than inventing a direction.
 *
 * @param movingLinePositions 1-indexed line positions, bottom-up.
 */
export function analyzeTiYong(input: {
  lower: Trigram;
  upper: Trigram;
  movingLinePositions: readonly number[];
}): TiYongAnalysis | null {
  const movingInLower = input.movingLinePositions.some((position) => position >= 1 && position <= 3);
  const movingInUpper = input.movingLinePositions.some((position) => position >= 4 && position <= 6);
  if (movingInLower === movingInUpper) return null;

  const yongTrigram = movingInLower ? input.lower : input.upper;
  const tiTrigram = movingInLower ? input.upper : input.lower;
  const tiPhase = trigramPhase(tiTrigram);
  const yongPhase = trigramPhase(yongTrigram);
  const relation = relationOf(tiPhase, yongPhase);

  return {
    ti: {
      trigram: tiTrigram,
      position: movingInLower ? "outer" : "inner",
      phase: tiPhase,
    },
    yong: {
      trigram: yongTrigram,
      position: movingInLower ? "inner" : "outer",
      phase: yongPhase,
    },
    relation,
    direction: RELATION_DIRECTION[relation],
  };
}
