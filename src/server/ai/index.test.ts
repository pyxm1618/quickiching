import { afterEach, describe, expect, it, vi } from "vitest";
import { runReading } from "./index";

const input = {
  result: {
    lineValuesBottomUp: [7, 7, 7, 7, 7, 7] as [7, 7, 7, 7, 7, 7],
    primaryHexagramNumber: 1,
    movingLinePositions: [],
    relatingHexagramNumber: null,
    method: "three_coin" as const,
    algorithmVersion: "three-coin-v1",
    classicMappingVersion: "king-wen-v1",
  },
  methodEvidence: {
    method: "three_coin" as const,
    rounds: [1, 2, 3, 4, 5, 6].map((linePosition) => ({
      linePosition: linePosition as 1 | 2 | 3 | 4 | 5 | 6,
      coinValues: [3, 2, 2] as const,
      lineValue: 7 as const,
    })),
  },
  scene: "career" as const,
  interpretationGoal: "what_do_i_need_to_see_clearly" as const,
  context: "I want perspective on my next role.",
};

afterEach(() => vi.unstubAllEnvs());

describe("AI adapter boundary", () => {
  it("does not fall back to local output for an unknown adapter mode", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_ADAPTER_MODE", "unknown");
    await expect(runReading(input)).rejects.toThrow("CONFIG_INVALID");
  });
});
