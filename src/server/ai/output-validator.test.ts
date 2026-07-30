import { describe, expect, it } from "vitest";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { buildClassicReferences } from "@/domain/classics";
import type { ReadingReport } from "@/domain/readings/types";
import { validatePreviewOutput, validateReadingReport } from "./output-validator";

const result = buildHexagramResult({
  lineValuesBottomUp: [9, 8, 7, 8, 7, 8],
  method: "three_coin",
  algorithmVersion: "three-coin-v1",
});

const generationInput = {
  result,
  scene: "career" as const,
  interpretationGoal: "what_should_i_pay_attention_to_next" as const,
  context: "I am considering a role change after repeated delays and unclear expectations.",
};

function validReport(): ReadingReport {
  return {
    readingVariant: "standard",
    coreSummary: "The main tension is between an established structure and pressure for a different arrangement. The present pattern is unsettled rather than complete. The moving line concentrates change at the beginning of the process. Watch whether expectations become explicit before treating the situation as resolved.",
    currentStage: "The situation is in a forming stage because the first line is moving while the upper structure remains comparatively stable. The evidence points to an early adjustment rather than a finished transition.",
    primaryHexagramPattern: "The primary hexagram places the user, other people, and external conditions in an uneven relationship. Existing expectations are relatively stable, while the practical route forward is less stable. This explains why progress can feel delayed even when the broad direction appears familiar.",
    changeMechanism: "Line 1 is the single moving line and therefore the main axis of change. It indicates that the first commitment, assumption, or boundary is where the current arrangement begins to shift. The remaining lines supply a structure that has not yet changed.",
    possibleDirection: "The relating hexagram describes a possible structure that may emerge if the initial adjustment continues. It is not a forecast. Clearer expectations could support that direction, while continued ambiguity could keep the present pattern in place.",
    obstaclesAndBlindSpots: "The principal obstacle is treating delay as proof that the opportunity has failed. A blind spot would be assuming that all parties use the same definition of progress. Missing information about authority, timing, and decision criteria remains material.",
    turningConditions: "Maintain the current interpretation while responsibilities become clearer and communication grows more consistent. Re-evaluate it if the decision maker changes, the role scope materially shifts, or promised milestones repeatedly pass without evidence. These are observable conditions rather than dates.",
    conditionalActionDirection: "Under current conditions, observation, clarification, and reversible preparation fit better than an irreversible commitment. A more active orientation becomes reasonable only after authority, expectations, and timing are confirmed. The reading does not make the career decision for the user.",
    uncertaintyAndBoundaries: "This interpretation uses the supplied career context, the primary hexagram, and the single moving line. It cannot account for undisclosed organizational constraints or future decisions by other people. It offers a reflective framework rather than professional, legal, medical, or financial advice.",
    interpretiveBasisReferences: buildClassicReferences(result),
  };
}

describe("PreviewOutput validation", () => {
  it("accepts a bounded relevance-only preview", () => {
    expect(validatePreviewOutput({
      relevanceStatement: "Your description of unclear expectations and delayed progress and the hexagram imagery both involve tension between an established arrangement and an unsettled first step. The connection is relevant without determining a stage, direction, outcome, or action for you.",
    }, generationInput)).toBeDefined();
  });

  it.each([
    { relevanceStatement: "Relevant." },
    { relevanceStatement: "You should resign immediately because the future is certain and success will follow." },
    { relevanceStatement: "This proves the situation is entering a decisive turning point and will improve next month." },
  ])("rejects previews that are too short, directive, absolute, or leak paid conclusions", (output) => {
    expect(() => validatePreviewOutput(output, generationInput)).toThrow();
  });
});

describe("ReadingReport validation", () => {
  it("accepts all ten modules with result-consistent controlled references", () => {
    expect(validateReadingReport(validReport(), generationInput)).toEqual(validReport());
  });

  it("rejects a missing module before persistence", () => {
    const { turningConditions: _missing, ...incomplete } = validReport();
    expect(() => validateReadingReport(incomplete, generationInput)).toThrow();
  });

  it("rejects references that do not match the primary, moving line, or relating hexagram", () => {
    const report = validReport();
    report.interpretiveBasisReferences = [{
      referenceId: "legge-1899-v1:hexagram-64:judgment",
      sourceVersion: "legge-1899-v1",
      hexagramNumber: 64,
      kind: "judgment",
    }];
    expect(() => validateReadingReport(report, generationInput)).toThrow("AI_REFERENCE_INTEGRITY_INVALID");
  });

  it("rejects absolute predictions and direct commands after structural validation", () => {
    const report = validReport();
    report.possibleDirection = "This will definitely happen next month and cannot be prevented, regardless of any new information, organizational decision, external constraint, or change in the situation described by the user.";
    report.conditionalActionDirection = "Quit your job now and do not reconsider the choice, even if authority, expectations, timing, or other real-world conditions change after this report is delivered.";
    expect(() => validateReadingReport(report, generationInput)).toThrow("AI_OUTPUT_SAFETY_INVALID");
  });

  it("rejects a reading variant inconsistent with moving-line facts", () => {
    const report = validReport();
    report.readingVariant = "still_hexagram";
    expect(() => validateReadingReport(report, generationInput)).toThrow("AI_RESULT_INTEGRITY_INVALID");
  });
});
