import { describe, expect, it } from "vitest";
import { normalizeDeepReadingViewModel } from "./deep-reading-view-model";

describe("normalizeDeepReadingViewModel", () => {
  it("normalizes current v3 reports", () => {
    const model = normalizeDeepReadingViewModel({
      schemaVersion: "deep-reading-v3",
      readingVariant: "standard",
      directAnswer: "This is the direct answer with enough detail to satisfy the current report contract and explain the immediate direction clearly.",
      whyThisReading: "This reading points to a focused transition because the active pattern emphasizes deliberate movement and evidence.",
      whatMattersMost: ["Keep the next move reversible while you gather concrete evidence from the situation."],
      whatToDoNext: ["Choose one small action that tests the direction and review the result before committing further."],
      uncertaintyAndBoundaries: "The reading cannot establish another person’s future choice, so observable follow-through remains the boundary.",
      interpretiveBasisReferences: [{ evidenceId: "primary.judgment" }],
      disclaimer: "Use this reading as reflective guidance rather than a certain prediction or professional advice.",
    });
    expect(model?.schemaVersion).toBe("ai-deep-reading-view-v1");
    expect(model?.coreLead).toContain("direct answer");
    expect(model?.nextSteps).toHaveLength(1);
  });

  it("rejects unknown report schemas instead of falling back to a second UI", () => {
    expect(normalizeDeepReadingViewModel({ schemaVersion: "unknown-v9" })).toBeNull();
  });
});
