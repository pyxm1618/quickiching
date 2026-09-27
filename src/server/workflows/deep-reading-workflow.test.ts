import { describe, expect, it, vi, beforeEach } from "vitest";
import { deepReadingWorkflow } from "./deep-reading-workflow";
import * as steps from "./deep-reading-steps";

describe("Deep Reading Workflow Orchestration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("orchestrates happy path: claim -> generate -> review (pass) -> finalize", async () => {
    const claimSpy = vi.spyOn(steps, "claimJobLeaseStep").mockResolvedValue({
      leaseToken: "lease-token-123",
      providerInput: {
        castingId: "cast-1",
        question: "How will my project go?",
        scene: "career",
        interpretationGoal: "what_do_i_need_to_see_clearly",
        context: {
          contextNotes: "The timeline changed and I need a clear next step.",
          options: [],
          constraints: [],
          concerns: [],
          interpretationGoal: "what_do_i_need_to_see_clearly",
          locale: "en",
        },
        knowledge: { evidence: [{ id: "primary.judgment" }] } as any,
        facts: {
          method: "three_coin",
          algorithmVersion: "three-coin-v1",
          classicMappingVersion: "king-wen-v1",
          lineValuesBottomUp: [7, 8, 7, 8, 7, 8],
          primaryHexagramNumber: 11,
          movingLinePositions: [],
          relatingHexagramNumber: null,
          readingVariant: "still_hexagram",
        },
      },
      inputSnapshotHash: "hash-123",
    });

    const generateSpy = vi.spyOn(steps, "generateDeepReadingStep").mockResolvedValue({
      output: { tenModules: [] } as any,
      deterministicFacts: {} as any,
    });

    const reviewSpy = vi.spyOn(steps, "reviewDeepReadingStep").mockResolvedValue({
      status: "pass",
      reasonCodes: [],
      schemaValid: true,
      safetyPass: true,
      factConsistencyPass: true,
      questionRelevancePass: true,
      contextFidelityPass: true,
      evidenceGroundingPass: true,
      interpretiveCoherencePass: true,
      actionabilityPass: true,
      uncertaintyPass: true,
      languageConsistencyPass: true,
    });

    const finalizeSpy = vi.spyOn(steps, "finalizeDeepReadingStep").mockResolvedValue({
      success: true,
    });

    const failureSpy = vi.spyOn(steps, "handleWorkflowFailureStep").mockResolvedValue();

    const result = await deepReadingWorkflow({
      castingId: "cast-1",
      jobId: "job-1",
      reservationId: "res-1",
      idempotencyKey: "deep:cast-1:0:job-1",
      generationEpoch: 0,
    });

    expect(result).toEqual({ status: "completed" });
    expect(claimSpy).toHaveBeenCalledTimes(1);
    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(reviewSpy).toHaveBeenCalledTimes(1);
    expect(finalizeSpy).toHaveBeenCalledTimes(1);
    expect(failureSpy).not.toHaveBeenCalled();
  });

  it("handles output review failure and triggers lease-fenced failure step", async () => {
    vi.spyOn(steps, "claimJobLeaseStep").mockResolvedValue({
      leaseToken: "lease-token-456",
      providerInput: {} as any,
      inputSnapshotHash: "hash-456",
    });

    vi.spyOn(steps, "generateDeepReadingStep").mockResolvedValue({
      output: {} as any,
      deterministicFacts: {} as any,
    });

    vi.spyOn(steps, "reviewDeepReadingStep").mockResolvedValue({
      status: "fail",
      reasonCodes: ["SAFETY_FAILED"],
      schemaValid: false,
      safetyPass: false,
      factConsistencyPass: true,
    });

    const finalizeSpy = vi.spyOn(steps, "finalizeDeepReadingStep").mockResolvedValue({ success: true });
    const failureSpy = vi.spyOn(steps, "handleWorkflowFailureStep").mockResolvedValue();

    const result = await deepReadingWorkflow({
      castingId: "cast-2",
      jobId: "job-2",
      reservationId: "res-2",
      idempotencyKey: "deep:cast-2:0:job-2",
      generationEpoch: 0,
    });

    expect(result).toEqual({ status: "failed", reason: "OUTPUT_REVIEW_FAILED" });
    expect(finalizeSpy).not.toHaveBeenCalled();
    expect(failureSpy).toHaveBeenCalledWith({
      jobId: "job-2",
      leaseToken: "lease-token-456",
      generationEpoch: 0,
      reservationId: "res-2",
      idempotencyKey: "deep:cast-2:0:job-2",
      errorCode: "OUTPUT_REVIEW_FAILED",
    });
  });

  it("fails and releases the reserved credit when review says the answer misses the question", async () => {
    vi.spyOn(steps, "claimJobLeaseStep").mockResolvedValue({
      leaseToken: "lease-token-question-fail",
      providerInput: {} as any,
      inputSnapshotHash: "hash-question-fail",
    });
    vi.spyOn(steps, "generateDeepReadingStep").mockResolvedValue({
      output: {} as any,
      deterministicFacts: {} as any,
    });
    vi.spyOn(steps, "reviewDeepReadingStep").mockResolvedValue({
      status: "pass",
      reasonCodes: [],
      schemaValid: true,
      safetyPass: true,
      factConsistencyPass: true,
      questionRelevancePass: false,
      contextFidelityPass: true,
      evidenceGroundingPass: true,
      interpretiveCoherencePass: true,
      actionabilityPass: true,
      uncertaintyPass: true,
      languageConsistencyPass: true,
    });

    const finalizeSpy = vi.spyOn(steps, "finalizeDeepReadingStep").mockResolvedValue({ success: true });
    const failureSpy = vi.spyOn(steps, "handleWorkflowFailureStep").mockResolvedValue();
    const result = await deepReadingWorkflow({
      castingId: "cast-question-fail",
      jobId: "job-question-fail",
      reservationId: "res-question-fail",
      idempotencyKey: "deep:cast-question-fail:0:job-question-fail",
      generationEpoch: 0,
    });

    expect(result).toEqual({ status: "failed", reason: "OUTPUT_REVIEW_FAILED" });
    expect(finalizeSpy).not.toHaveBeenCalled();
    expect(failureSpy).toHaveBeenCalledWith(expect.objectContaining({
      reservationId: "res-question-fail",
      errorCode: "OUTPUT_REVIEW_FAILED",
    }));
  });

  it("handles runtime exception in generation and calls failure step with leaseToken", async () => {
    vi.spyOn(steps, "claimJobLeaseStep").mockResolvedValue({
      leaseToken: "lease-token-789",
      providerInput: {} as any,
      inputSnapshotHash: "hash-789",
    });

    vi.spyOn(steps, "generateDeepReadingStep").mockRejectedValue(new Error("AI_GATEWAY_TIMEOUT"));
    const failureSpy = vi.spyOn(steps, "handleWorkflowFailureStep").mockResolvedValue();

    await expect(deepReadingWorkflow({
      castingId: "cast-3",
      jobId: "job-3",
      reservationId: "res-3",
      idempotencyKey: "deep:cast-3:0:job-3",
      generationEpoch: 0,
    })).rejects.toThrow("AI_GATEWAY_TIMEOUT");

    expect(failureSpy).toHaveBeenCalledWith({
      jobId: "job-3",
      leaseToken: "lease-token-789",
      generationEpoch: 0,
      reservationId: "res-3",
      idempotencyKey: "deep:cast-3:0:job-3",
      errorCode: "AI_GATEWAY_TIMEOUT",
    });
  });

  it("releases a reserved credit when the claim fails before acquiring a lease", async () => {
    vi.spyOn(steps, "claimJobLeaseStep").mockRejectedValue(new Error("CAST_SCENE_SNAPSHOT_MISMATCH"));
    const unclaimedFailureSpy = vi.spyOn(steps, "handleUnclaimedWorkflowFailureStep").mockResolvedValue();
    const leasedFailureSpy = vi.spyOn(steps, "handleWorkflowFailureStep").mockResolvedValue();

    await expect(deepReadingWorkflow({
      castingId: "cast-unclaimed-failure",
      jobId: "job-unclaimed-failure",
      reservationId: "res-unclaimed-failure",
      idempotencyKey: "deep:cast-unclaimed-failure:0:job-unclaimed-failure",
      generationEpoch: 0,
    })).rejects.toThrow("CAST_SCENE_SNAPSHOT_MISMATCH");

    expect(unclaimedFailureSpy).toHaveBeenCalledWith({
      jobId: "job-unclaimed-failure",
      castingId: "cast-unclaimed-failure",
      generationEpoch: 0,
      reservationId: "res-unclaimed-failure",
      idempotencyKey: "deep:cast-unclaimed-failure:0:job-unclaimed-failure",
      errorCode: "CAST_SCENE_SNAPSHOT_MISMATCH",
    });
    expect(leasedFailureSpy).not.toHaveBeenCalled();
  });
});
