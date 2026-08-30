import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildDeterministicVerdict } from "@/domain/interpretation/deterministic/verdict";
import { deepReadingWorkflow } from "./deep-reading-workflow";
import * as steps from "./deep-reading-steps";

// 泰 (11): qian below, kun above, nothing moving.
const FACTS = {
  method: "three_coin",
  algorithmVersion: "three-coin-v1",
  classicMappingVersion: "king-wen-v1",
  lineValuesBottomUp: [7, 7, 7, 8, 8, 8],
  primaryHexagramNumber: 11,
  movingLinePositions: [],
  relatingHexagramNumber: null,
  readingVariant: "still_hexagram",
} as const;

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
        facts: { ...FACTS, lineValuesBottomUp: [...FACTS.lineValuesBottomUp], movingLinePositions: [] },
        verdict: buildDeterministicVerdict({
          ...FACTS,
          lineValuesBottomUp: [...FACTS.lineValuesBottomUp] as never,
          movingLinePositions: [],
        }),
        locale: "en",
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
      locale: "en",
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
      locale: "en",
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
      locale: "en",
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
});
