import { ALGORITHM_VERSIONS, type LineValue } from "../types";

// §8.2 Three-Coin v1. yang/head = 3, yin/tail = 2. Three coins summed => 6/7/8/9.
// Randomness is injected so the function stays pure, deterministic, testable, and runtime-neutral.

export type CoinFace = "yin" | "yang";
export type ThreeCoinStep = {
  lineIndex: 0 | 1 | 2 | 3 | 4 | 5;
  coinFaces: readonly [CoinFace, CoinFace, CoinFace];
  lineValue: LineValue;
  algorithmVersion: string;
};

// A fair bit source: returns true for yang (head=3), false for yin (tail=2).
export type RandomBit = () => boolean;

export function generateThreeCoinLine(
  lineIndex: 0 | 1 | 2 | 3 | 4 | 5,
  randomBit: RandomBit,
): ThreeCoinStep {
  const faces: CoinFace[] = [
    randomBit() ? "yang" : "yin",
    randomBit() ? "yang" : "yin",
    randomBit() ? "yang" : "yin",
  ];
  const sum = faces.reduce((acc, face) => acc + (face === "yang" ? 3 : 2), 0);
  const lineValue = sum as LineValue;
  return {
    lineIndex,
    coinFaces: faces as unknown as ThreeCoinStep["coinFaces"],
    lineValue,
    algorithmVersion: ALGORITHM_VERSIONS.three_coin,
  };
}
