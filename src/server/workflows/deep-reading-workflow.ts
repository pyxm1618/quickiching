import {
  claimJobLeaseStep,
  generateDeepReadingStep,
  reviewDeepReadingStep,
  finalizeDeepReadingStep,
  handleWorkflowFailureStep,
} from "./deep-reading-steps";

export type DeepReadingWorkflowInput = {
  castingId: string;
  jobId: string;
  reservationId: string;
  idempotencyKey: string;
  generationEpoch: number;
};

export async function deepReadingWorkflow(input: DeepReadingWorkflowInput) {
  "use workflow";

  let activeLeaseToken = "";

  try {
    // Step 1: Claim lease and fetch snapshot
    const { leaseToken, providerInput, inputSnapshotHash } = await claimJobLeaseStep({
      castingId: input.castingId,
      jobId: input.jobId,
      idempotencyKey: input.idempotencyKey,
      generationEpoch: input.generationEpoch,
    });
    activeLeaseToken = leaseToken;

    // Step 2: Generate AI Reading
    const generationResult = await generateDeepReadingStep({
      providerInput,
      jobId: input.jobId,
      leaseToken,
    });

    // Step 3: Review Output
    const reviewDecision = await reviewDeepReadingStep({
      output: generationResult.output,
      facts: providerInput.facts,
      jobId: input.jobId,
      leaseToken,
    });

    if (reviewDecision.status !== "pass") {
      await handleWorkflowFailureStep({
        jobId: input.jobId,
        leaseToken: activeLeaseToken,
        generationEpoch: input.generationEpoch,
        reservationId: input.reservationId,
        idempotencyKey: input.idempotencyKey,
        errorCode: "OUTPUT_REVIEW_FAILED",
      });
      return { status: "failed", reason: "OUTPUT_REVIEW_FAILED" };
    }

    // Step 4: Finalize and consume credit
    await finalizeDeepReadingStep({
      castingId: input.castingId,
      jobId: input.jobId,
      reservationId: input.reservationId,
      idempotencyKey: input.idempotencyKey,
      generationEpoch: input.generationEpoch,
      inputSnapshotHash,
      leaseToken,
      generationResult,
      reviewDecision,
    });

    return { status: "completed" };
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "WORKFLOW_EXECUTION_FAILED";
    if (activeLeaseToken) {
      await handleWorkflowFailureStep({
        jobId: input.jobId,
        leaseToken: activeLeaseToken,
        generationEpoch: input.generationEpoch,
        reservationId: input.reservationId,
        idempotencyKey: input.idempotencyKey,
        errorCode,
      });
    }
    throw error;
  }
}
