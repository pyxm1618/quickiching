import type { GenerationInput } from "@/server/ai";
import type { GenerationAttemptAudit } from "@/server/ai/gateway-provider";

export type GenerationJobType = "preview" | "deep_reading";
export type GenerationJobStatus = "queued" | "running" | "completed" | "failed" | "timed_out";

export type GenerationJob = {
  id: string;
  jobType: GenerationJobType;
  castingId: string;
  readingId: string | null;
  reservationId: string | null;
  status: GenerationJobStatus;
  generationEpoch: number;
  snapshot: unknown;
  timeoutAt: Date;
};

export interface GenerationJobRepository {
  enqueue(input: {
    jobType: GenerationJobType;
    castingId: string;
    readingId: string | null;
    reservationId: string | null;
    snapshot: unknown;
    timeoutAt: Date;
    outboxTopic: "generation.requested";
  }): Promise<GenerationJob>;
  claim(jobId: string, now: Date): Promise<GenerationJob>;
  complete(input: {
    jobId: string;
    generationEpoch: number;
    output: unknown;
    attempts: GenerationAttemptAudit[];
    now: Date;
  }): Promise<boolean>;
  fail(input: {
    jobId: string;
    generationEpoch: number;
    errorCode: string;
    now: Date;
  }): Promise<{ terminal: boolean }>;
}

type GenerationProvider = {
  generatePreview(input: GenerationInput): Promise<{ output: unknown; attempts: GenerationAttemptAudit[] }>;
  generateReading(input: GenerationInput): Promise<{ output: unknown; attempts: GenerationAttemptAudit[] }>;
};

type EntitlementFinalizer = {
  consume(reservationId: string): unknown | Promise<unknown>;
  release(reservationId: string, expired: boolean): unknown | Promise<unknown>;
};

function errorCode(error: unknown): string {
  if (error instanceof Error) return error.message.split(":", 1)[0].slice(0, 100) || "GENERATION_FAILED";
  return "GENERATION_FAILED";
}

export class GenerationJobService {
  constructor(private readonly dependencies: {
    repository: GenerationJobRepository;
    provider: GenerationProvider;
    entitlement: EntitlementFinalizer;
    clock: { now(): Date };
  }) {}

  enqueuePreview(input: { castingId: string; snapshot: GenerationInput }): Promise<GenerationJob> {
    const now = this.dependencies.clock.now();
    return this.dependencies.repository.enqueue({
      jobType: "preview",
      castingId: input.castingId,
      readingId: null,
      reservationId: null,
      snapshot: input.snapshot,
      timeoutAt: new Date(now.getTime() + 2 * 60 * 1000),
      outboxTopic: "generation.requested",
    });
  }

  enqueueReading(input: {
    castingId: string;
    readingId: string;
    reservationId: string;
    snapshot: unknown;
  }): Promise<GenerationJob> {
    const now = this.dependencies.clock.now();
    return this.dependencies.repository.enqueue({
      jobType: "deep_reading",
      castingId: input.castingId,
      readingId: input.readingId,
      reservationId: input.reservationId,
      snapshot: input.snapshot,
      timeoutAt: new Date(now.getTime() + 5 * 60 * 1000),
      outboxTopic: "generation.requested",
    });
  }

  async execute(jobId: string): Promise<{ completed: boolean; generationEpoch: number }> {
    const job = await this.dependencies.repository.claim(jobId, this.dependencies.clock.now());
    try {
      const generated = job.jobType === "preview"
        ? await this.dependencies.provider.generatePreview(job.snapshot as GenerationInput)
        : await this.dependencies.provider.generateReading(job.snapshot as GenerationInput);
      const completed = await this.dependencies.repository.complete({
        jobId: job.id,
        generationEpoch: job.generationEpoch,
        output: generated.output,
        attempts: generated.attempts,
        now: this.dependencies.clock.now(),
      });
      if (completed && job.jobType === "deep_reading" && job.reservationId) {
        await this.dependencies.entitlement.consume(job.reservationId);
      }
      return { completed, generationEpoch: job.generationEpoch };
    } catch (error) {
      const failure = await this.dependencies.repository.fail({
        jobId: job.id,
        generationEpoch: job.generationEpoch,
        errorCode: errorCode(error),
        now: this.dependencies.clock.now(),
      });
      if (failure.terminal && job.jobType === "deep_reading" && job.reservationId) {
        await this.dependencies.entitlement.release(job.reservationId, false);
      }
      throw error;
    }
  }
}
