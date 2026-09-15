import type { CreateJobInput, GenerationJobRecord } from "./types";

export type GenerationRepositoryErrorCode =
  | "GENERATION_IDEMPOTENCY_CONFLICT"
  | "GENERATION_JOB_UNAVAILABLE"
  | "PREVIEW_RETRY_BUDGET_EXCEEDED";

export class GenerationRepositoryError extends Error {
  readonly code: GenerationRepositoryErrorCode;

  constructor(code: GenerationRepositoryErrorCode) {
    super(code);
    this.name = "GenerationRepositoryError";
    this.code = code;
  }
}

export function assertReusablePreviewJob(job: GenerationJobRecord, input: CreateJobInput): void {
  if (
    job.castingId !== input.castingId
    || job.kind !== input.kind
    || job.generationEpoch !== input.generationEpoch
    || job.inputSnapshotHash !== input.inputSnapshotHash
  ) {
    throw new GenerationRepositoryError("GENERATION_IDEMPOTENCY_CONFLICT");
  }
}
