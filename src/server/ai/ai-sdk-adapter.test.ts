import { describe, expect, it, vi } from "vitest";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { buildClassicReferences } from "@/domain/classics";
import { AiSdkAdapter } from "./ai-sdk-adapter";

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

const validPreview = {
  relevanceStatement: "Your description of delayed progress and unclear expectations connects with the hexagram pattern of an established structure under pressure at its first moving point. This is relevant as a reflective comparison, not a prediction or instruction.",
};

const validReading = {
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
  interpretiveBasisReferences: buildClassicReferences(input.result),
};

describe("AiSdkAdapter", () => {
  it("routes preview generation through a configured Gateway model with structured output and cost tags", async () => {
    const generateText = vi.fn().mockResolvedValue({
      output: validPreview,
      usage: { inputTokens: 321, outputTokens: 75 },
      response: { id: "provider-preview-1" },
    });
    const adapter = new AiSdkAdapter({
      generateText,
      outputObject: (schema) => ({ kind: "object", schema }),
      models: { preview: "openai/gpt-5-mini", deepReading: "openai/gpt-5.2", outputReview: "openai/gpt-5-mini" },
      timeoutMs: 20_000,
    });

    const result = await adapter.generatePreview(input, {
      userId: "usr_ai",
      jobId: "job_preview",
      epoch: 1,
      attempt: 1,
    });

    expect(generateText).toHaveBeenCalledTimes(1);
    const request = generateText.mock.calls[0][0];
    expect(request).toMatchObject({
      model: "openai/gpt-5-mini",
      output: { kind: "object" },
      temperature: 0.2,
      maxOutputTokens: 500,
      providerOptions: {
        gateway: {
          user: "usr_ai",
          tags: ["feature:preview", "job:job_preview", "epoch:1"],
          cacheControl: "max-age=0",
        },
      },
    });
    expect(request.tools).toBeUndefined();
    expect(request.prompt).toContain('"context":"I am considering a role change');
    expect(result).toMatchObject({ output: validPreview, providerRequestId: "provider-preview-1" });
  });

  it("uses the deep-reading model and validates the ten-module object before returning it", async () => {
    const generateText = vi.fn().mockResolvedValue({
      output: validReading,
      usage: { inputTokens: 700, outputTokens: 1300 },
      response: { id: "provider-reading-1" },
    });
    const adapter = new AiSdkAdapter({
      generateText,
      outputObject: (schema) => ({ kind: "object", schema }),
      models: { preview: "openai/gpt-5-mini", deepReading: "openai/gpt-5.2", outputReview: "openai/gpt-5-mini" },
      timeoutMs: 30_000,
    });

    const result = await adapter.generateReading(input, {
      userId: "usr_ai",
      jobId: "job_reading",
      epoch: 2,
      attempt: 1,
    });

    expect(generateText.mock.calls[0][0]).toMatchObject({
      model: "openai/gpt-5.2",
      maxOutputTokens: 5000,
      providerOptions: {
        gateway: {
          user: "usr_ai",
          tags: ["feature:deep-reading", "job:job_reading", "epoch:2"],
        },
      },
    });
    expect(result.output).toEqual(validReading);
  });

  it("retries only retryable provider failures with bounded backoff", async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const rateLimitError = Object.assign(new Error("rate limited"), { statusCode: 429 });
    const generateText = vi.fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({ output: validPreview, usage: {}, response: { id: "provider-retry" } });
    const adapter = new AiSdkAdapter({
      generateText,
      outputObject: (schema) => ({ kind: "object", schema }),
      models: { preview: "openai/gpt-5-mini", deepReading: "openai/gpt-5.2", outputReview: "openai/gpt-5-mini" },
      timeoutMs: 20_000,
      wait,
      random: () => 0,
    });

    await expect(adapter.generatePreview(input, {
      userId: "usr_ai", jobId: "job_retry", epoch: 1, attempt: 1,
    })).resolves.toMatchObject({ providerRequestId: "provider-retry" });
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the model output violates the controlled schema", async () => {
    const adapter = new AiSdkAdapter({
      generateText: vi.fn().mockResolvedValue({ output: { relevanceStatement: "Relevant." }, usage: {}, response: {} }),
      outputObject: (schema) => ({ kind: "object", schema }),
      models: { preview: "openai/gpt-5-mini", deepReading: "openai/gpt-5.2", outputReview: "openai/gpt-5-mini" },
      timeoutMs: 20_000,
    });

    await expect(adapter.generatePreview(input, {
      userId: "usr_ai", jobId: "job_invalid", epoch: 1, attempt: 1,
    })).rejects.toThrow("AI_PREVIEW_LENGTH_INVALID");
  });
});
