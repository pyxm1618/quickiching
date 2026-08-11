import { describe, expect, it } from "vitest";
import { ALGORITHM_VERSIONS } from "@/domain/casting/types";
import type { ThreeCoinStep } from "@/domain/casting/three-coin/algorithm";
import {
  completedThreeCoinSteps,
  parseThreeCoinSteps,
  THREE_COIN_SESSION_STORAGE_KEY,
} from "./three-coin-session";

function step(lineIndex: number, lineValue: 6 | 7 | 8 | 9 = 7): ThreeCoinStep {
  return {
    lineIndex: lineIndex as ThreeCoinStep["lineIndex"],
    coinFaces: lineValue === 6
      ? ["yin", "yin", "yin"]
      : lineValue === 7
        ? ["yang", "yin", "yin"]
        : lineValue === 8
          ? ["yang", "yang", "yin"]
          : ["yang", "yang", "yang"],
    lineValue,
    algorithmVersion: ALGORITHM_VERSIONS.three_coin,
  };
}

function validSteps(count = 6): ThreeCoinStep[] {
  return Array.from({ length: count }, (_, index) => step(index, ([7, 8, 9, 6, 7, 8] as const)[index] ?? 7));
}

describe("Three-Coin browser session contract", () => {
  it("keeps the established storage key stable", () => {
    expect(THREE_COIN_SESSION_STORAGE_KEY).toBe("quickiching:public-v1:three-coin");
  });

  it("accepts a valid partial cast without treating it as completed", () => {
    const parsed = parseThreeCoinSteps(JSON.stringify(validSteps(4)));
    expect(parsed).toHaveLength(4);
    expect(completedThreeCoinSteps(parsed)).toBeNull();
  });

  it("accepts exactly six valid sequential steps as a completed cast", () => {
    const parsed = parseThreeCoinSteps(JSON.stringify(validSteps()));
    const completed = completedThreeCoinSteps(parsed);
    expect(completed).not.toBeNull();
    expect(completed?.map((entry) => entry.lineIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(completed?.map((entry) => entry.lineValue)).toEqual([7, 8, 9, 6, 7, 8]);
  });

  it.each([
    ["malformed json", "{"],
    ["non-array", JSON.stringify({ lineIndex: 0 })],
    ["too many steps", JSON.stringify(validSteps(6).concat(step(5)))],
    ["discontinuous indexes", JSON.stringify([step(0), step(2)])],
    ["invalid line value", JSON.stringify([{ ...step(0), lineValue: 5 }])],
    ["invalid coin face", JSON.stringify([{ ...step(0), coinFaces: ["yang", "yin", "edge"] }])],
    ["wrong algorithm version", JSON.stringify([{ ...step(0), algorithmVersion: "three-coin-v0" }])],
  ])("rejects %s", (_label, raw) => {
    expect(parseThreeCoinSteps(raw)).toEqual([]);
  });

  it("rejects a line value that does not agree with the stored coin faces", () => {
    expect(parseThreeCoinSteps(JSON.stringify([{ ...step(0, 7), lineValue: 9 }]))).toEqual([]);
  });
});
