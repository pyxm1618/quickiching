import { describe, expect, it } from "vitest";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import type { CastingMethodEvidence } from "@/domain/casting/method-evidence";
import { generateLocalPreview, generateLocalReading } from "./local-adapter";

const result = buildHexagramResult({
  lineValuesBottomUp: [9, 8, 7, 8, 7, 8],
  method: "three_coin",
  algorithmVersion: "three-coin-v1",
});

const methodEvidence: CastingMethodEvidence = {
  method: "three_coin",
  rounds: [
    { linePosition: 1, coinValues: [3, 3, 3], lineValue: 9 },
    { linePosition: 2, coinValues: [3, 3, 2], lineValue: 8 },
    { linePosition: 3, coinValues: [3, 2, 2], lineValue: 7 },
    { linePosition: 4, coinValues: [3, 3, 2], lineValue: 8 },
    { linePosition: 5, coinValues: [3, 2, 2], lineValue: 7 },
    { linePosition: 6, coinValues: [3, 3, 2], lineValue: 8 },
  ],
};

describe("deterministic local AI adapter", () => {
  it("changes preview output when the supplied context changes", () => {
    const first = generateLocalPreview({
      result,
      scene: "career",
      context: "I am considering a role change after repeated delays.",
    });
    const second = generateLocalPreview({
      result,
      scene: "career",
      context: "I am trying to repair trust with a long-term colleague.",
    });

    expect(first).not.toEqual(second);
    expect(first.relevanceStatement.toLowerCase()).toContain("role change");
    expect(second.relevanceStatement.toLowerCase()).toContain("repair trust");
  });

  it("uses interpretation goal, method evidence, and moving-line facts in the reading", () => {
    const report = generateLocalReading({
      result,
      methodEvidence,
      scene: "career",
      goal: "what_should_i_pay_attention_to_next",
      context: "I am considering a role change after repeated delays.",
    });

    const serialized = JSON.stringify(report).toLowerCase();
    expect(serialized).toContain("pay attention");
    expect(serialized).toContain("three-coin");
    expect(serialized).toContain("six persisted");
    expect(serialized).toContain("line 1");
    expect(serialized).toContain("role change");
  });

  it("produces output that passes the same validators used for provider output", async () => {
    const { validatePreviewOutput, validateReadingReport } = await import("./output-validator");
    const input = {
      result,
      methodEvidence,
      scene: "career" as const,
      interpretationGoal: "what_should_i_pay_attention_to_next" as const,
      context: "I am considering a role change after repeated delays.",
    };

    expect(validatePreviewOutput(generateLocalPreview({
      result,
      scene: input.scene,
      context: input.context,
    }), input)).toBeDefined();
    expect(validateReadingReport(generateLocalReading({
      result,
      methodEvidence,
      scene: input.scene,
      goal: input.interpretationGoal,
      context: input.context,
    }), input)).toBeDefined();
  });
});
