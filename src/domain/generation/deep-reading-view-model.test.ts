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

  it("normalizes historical v2 reports", () => {
    const model = normalizeDeepReadingViewModel({
      schemaVersion: "deep-reading-v2",
      readingVariant: "standard",
      directAnswer: "A clear next step depends on what is confirmed in the current situation and which option remains reversible.",
      situationMapping: "The cast describes an active transition, while the supplied context determines which part of that pattern applies now.",
      keyTensions: ["Move with purpose while keeping the decision open to new evidence."],
      conditionalDirection: "If the relevant support is present, a measured next step can test the direction without committing to the full outcome.",
      signalsToWatch: ["Watch whether the other party follows through on the specific commitment."],
      practicalReflection: "Write down what would count as reliable evidence, then choose one action that can be reviewed soon.",
      uncertaintyAndBoundaries: "The cast cannot establish what another person will decide; that remains unknown until observable actions occur.",
      interpretiveBasisReferences: [{ evidenceId: "primary:judgment" }],
      disclaimer: "This is conditional reflection and not a certain prediction.",
    });
    expect(model?.coreLead).toContain("clear next step");
    expect(model?.whyItems[0]).toContain("active transition");
  });

  it("normalizes historical commercial v1 reports", () => {
    const model = normalizeDeepReadingViewModel({
      schemaVersion: "commercial-reading-v1",
      readingVariant: "standard",
      coreSummary: "The situation calls for a measured response that protects room to adjust as new information becomes available.",
      currentStage: "You are at a decision point where preparation matters more than speed.",
      primaryHexagramPattern: "The primary pattern emphasizes sustained effort and disciplined timing.",
      changeMechanism: "Change develops through a narrow opening rather than a sudden reversal.",
      possibleDirection: "Progress is possible when support becomes visible and repeatable.",
      obstaclesAndBlindSpots: "The main risk is treating an early signal as if it were a durable commitment.",
      turningConditions: "Act when the relevant support is concrete enough to verify in practice.",
      conditionalActionDirection: "Take one reversible step, then reassess before increasing commitment.",
      uncertaintyAndBoundaries: "The reading cannot guarantee an external outcome or another person’s decision.",
      interpretiveBasisReferences: [],
      disclaimer: "Use this for reflection rather than certainty or professional advice.",
    });
    expect(model?.coreLead).toContain("measured response");
    expect(model?.changeItems.length).toBeGreaterThan(0);
  });

  it("rejects unknown report schemas instead of falling back to a second UI", () => {
    expect(normalizeDeepReadingViewModel({ schemaVersion: "unknown-v9" })).toBeNull();
  });
});
