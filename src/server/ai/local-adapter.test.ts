import { describe, expect, it } from "vitest";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { generateLocalPreview, generateLocalReading } from "./local-adapter";

const result = buildHexagramResult({
  lineValuesBottomUp: [9, 8, 7, 8, 7, 8],
  method: "three_coin",
  algorithmVersion: "three-coin-v1",
});

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

  it("uses interpretation goal, method, and moving-line facts in the reading", () => {
    const report = generateLocalReading({
      result,
      scene: "career",
      goal: "what_should_i_pay_attention_to_next",
      context: "I am considering a role change after repeated delays.",
    });

    const serialized = JSON.stringify(report).toLowerCase();
    expect(serialized).toContain("pay attention");
    expect(serialized).toContain("three-coin");
    expect(serialized).toContain("line 1");
    expect(serialized).toContain("role change");
  });

  it("produces output that passes the same validators used for provider output", async () => {
    const { validatePreviewOutput, validateReadingReport } = await import("./output-validator");
    const input = {
      result,
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
      scene: input.scene,
      goal: input.interpretationGoal,
      context: input.context,
    }), input)).toBeDefined();
  });
});
