import { ALGORITHM_VERSIONS, type LineValue } from "../types";

// §8.2 Three-Coin v1. yang/head = 3, yin/tail = 2. Three coins summed => 6/7/8/9.
// Randomness is injected so the core function stays pure, deterministic, testable, and runtime-neutral.

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

// Compatibility export for preserved Commercial V2 server actions. Public V1 UI does not call
// this adapter; it injects src/lib/browser-random.ts explicitly. Modern Node and browsers both
// expose Web Crypto, so keeping this compatibility path here does not pull node:crypto into a
// Client Component bundle.
export function cryptoRandomBit(): boolean {
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("WEB_CRYPTO_UNAVAILABLE");
  }
  const bytes = new Uint8Array(1);
  globalThis.crypto.getRandomValues(bytes);
  return (bytes[0] & 1) === 1;
}
