import { describe, expect, it, vi } from "vitest";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { buildClassicReferences } from "@/domain/classics";
import { AiSdkGatewayProvider } from "./gateway-provider";

const input = {
  result: buildHexagramResult({
    lineValuesBottomUp: [9, 8, 7, 8, 7, 8],
    method: "three_coin" as const,
    algorithmVersion: "three-coin-v1",
  }),
  scene: "career" as const,
  interpretationGoal: "what_should_i_pay_attention_to_next" as const,
  context: "I am considering a role change after repeated delays and unclear expectations.",
};

const report = {
  readingVariant: "standard" as const,
  coreSummary: "The situation centers on a tension between established expectations and pressure for a different arrangement. The present pattern remains unsettled rather than complete. The moving first line concentrates change at the beginning of the process. Watch whether responsibilities and decision authority become explicit before treating the direction as resolved.",
  currentStage: "The situation is in a forming stage because the first line is moving while the upper structure remains comparatively stable. This indicates an early adjustment rather than a finished transition, with the initial assumptions and boundaries still being tested by current conditions.",
  primaryHexagramPattern: "The primary hexagram places the user, other people, and external conditions in an uneven relationship. Existing expectations are relatively stable, while the practical route forward is less stable. This explains why progress can feel delayed even when the broad direction appears familiar.",
  changeMechanism: "Line 1 is the single moving line and therefore the main axis of change. It indicates that the first commitment, assumption, or boundary is where the current arrangement begins to shift. The remaining lines supply a structure that has not yet changed.",
  possibleDirection: "The relating hexagram describes a possible structure that may emerge if the initial adjustment continues. It is not a forecast. Clearer expectations could support that direction, while continued ambiguity could keep the present pattern in place.",
  obstaclesAndBlindSpots: "The principal obstacle is treating delay as proof that the opportunity has failed. A blind spot would be assuming that all parties use the same definition of progress. Missing information about authority, timing, and decision criteria remains material.",
  turningConditions: "Maintain the current interpretation while responsibilities become clearer and communication grows more consistent. Re-evaluate it if the decision maker changes, the role scope materially shifts, or promised milestones repeatedly pass without evidence. These are observable conditions rather than dates.",
  conditionalActionDirection: "Under current conditions, observation, clarification, and reversible preparation fit better than an irreversible commitment. A more active orientation becomes reasonable only after authority, expectations, and timing are confirmed. The reading does not make the career decision for the user.",
  uncertaintyAndBoundaries: "This interpretation uses the supplied career context, the primary hexagram, and the single moving line. It cannot account for undisclosed organizational constraints or future decisions by other people. It offers a reflective framework rather than professional, legal, medical, or financial advice.",
  interpretiveBasisReferences: buildClassicReferences(input.result),
};

describe("AiSdkGatewayProvider", () => {
  it("generates a schema-bound reading, then obtains independent approval from the review model", async () => {
    const generateStructured = vi.fn()
      .mockResolvedValueOnce({ output: report, usage: { inputTokens: 800, outputTokens: 900 }, providerRequestId: "req_generate" })
      .mockResolvedValueOnce({ output: { approved: true, reasonCodes: [], notes: "Validated." }, usage: { inputTokens: 500, outputTokens: 30 }, providerRequestId: "req_review" });
    const provider = new AiSdkGatewayProvider({
      apiKey: "gateway-key",
      models: { preview: "provider/preview", reading: "provider/reading", review: "provider/review" },
      generateStructured,
    });

    const result = await provider.generateReading(input);

    expect(result.output).toEqual(report);
    expect(result.attempts).toHaveLength(2);
    expect(generateStructured).toHaveBeenNthCalledWith(1, expect.objectContaining({
      model: "provider/reading",
      promptVersion: "reading-v2.1.0",
    }));
    expect(generateStructured).toHaveBeenNthCalledWith(2, expect.objectContaining({
      model: "provider/review",
      promptVersion: "output-review-v2.1.0",
    }));
    expect(JSON.stringify(generateStructured.mock.calls)).toContain(input.context);
  });

  it("rejects a candidate when the independent review model does not approve it", async () => {
    const generateStructured = vi.fn()
      .mockResolvedValueOnce({ output: report, usage: {}, providerRequestId: "req_generate" })
      .mockResolvedValueOnce({ output: { approved: false, reasonCodes: ["directive_language"], notes: "Unsafe." }, usage: {}, providerRequestId: "req_review" });
    const provider = new AiSdkGatewayProvider({
      apiKey: "gateway-key",
      models: { preview: "provider/preview", reading: "provider/reading", review: "provider/review" },
      generateStructured,
    });

    await expect(provider.generateReading(input)).rejects.toThrow("AI_OUTPUT_REVIEW_REJECTED");
  });
});
