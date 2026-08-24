import { randomUUID } from "node:crypto";
import { deepStrictEqual } from "node:assert";
import { evaluateRisk } from "@/domain/risk/engine";
import {
  deterministicFactsSchema,
  previewOutputSchema,
  type CommercialPreviewOutput,
} from "@/domain/generation/schemas";
import {
  buildPreviewPrompt,
  classifyGenerationError,
  hashGenerationSnapshot,
  validatePreviewSafety,
} from "./boundary";
import type {
  GenerationJobRecord,
  OutputReviewer,
  PreviewGenerationContext,
  PreviewGenerationRepository,
  PreviewGenerationResult,
  PreviewProvider,
  PreviewResultRecord,
  ProviderInput,
} from "./types";
export type { OutputReviewer, PreviewProvider, ProviderInput } from "./types";

type Runtime = {
  repository: PreviewGenerationRepository;
  provider: PreviewProvider;
  reviewer: OutputReviewer;
  timeoutMs?: number;
  maxOutputTokens?: number;
  now?: () => Date;
  verifyResultIntegrity?: (context: PreviewGenerationContext) => Promise<boolean> | boolean;
};

export type PreviewGenerationRequest = {
  castingId: string;
  userId: string;
  idempotencyKey: string;
  signal?: AbortSignal;
};

export class PreviewGenerationError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, retryable = false) {
    super(code);
    this.name = "PreviewGenerationError";
    this.code = code;
    this.retryable = retryable;
  }
}

function stateResult(job: GenerationJobRecord, result?: PreviewResultRecord): PreviewGenerationResult {
  return { status: job.status, jobId: job.id, ...(result ? { result } : {}) };
}

function cloneErrorCode(error: unknown): string {
  return error instanceof PreviewGenerationError ? error.code : classifyGenerationError(error).code;
}

function timeoutPromise<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  callerSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort(new Error("AI_GATEWAY_TIMEOUT"));
      reject(new PreviewGenerationError("AI_GATEWAY_TIMEOUT", true));
    }, timeoutMs);
  });
  return Promise.race([operation(controller.signal), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  });
}

export class PreviewGenerationService {
  // Public for test fixtures and explicit dependency inspection; production callers should
  // provide the PostgreSQL implementation rather than this in-memory test adapter.
  readonly repository: PreviewGenerationRepository;
  private readonly provider: PreviewProvider;
  private readonly reviewer: OutputReviewer;
  private readonly timeoutMs: number;
  private readonly maxOutputTokens?: number;
  private readonly now: () => Date;
  private readonly verifyResultIntegrity: (context: PreviewGenerationContext) => Promise<boolean> | boolean;

  constructor(runtime: Runtime) {
    this.repository = runtime.repository;
    this.provider = runtime.provider;
    this.reviewer = runtime.reviewer;
    this.timeoutMs = runtime.timeoutMs ?? 30_000;
    this.maxOutputTokens = runtime.maxOutputTokens;
    this.now = runtime.now ?? (() => new Date());
    this.verifyResultIntegrity = runtime.verifyResultIntegrity ?? ((context) => context.resultIntegrityValid !== false);
  }

  async generate(request: PreviewGenerationRequest): Promise<PreviewGenerationResult> {
    if (!request.idempotencyKey.trim() || request.idempotencyKey.length > 256) {
      throw new PreviewGenerationError("IDEMPOTENCY_KEY_INVALID");
    }
    const context = await this.repository.getPreviewContext(request.castingId);
    if (!context || context.userId !== request.userId) throw new PreviewGenerationError("CASTING_NOT_FOUND");
    if (context.lifecycle !== "revealed") throw new PreviewGenerationError("PREVIEW_NOT_REVEALED");
    if (context.riskStatus !== "allowed") throw new PreviewGenerationError("RISK_BLOCKED");
    if ((await this.verifyResultIntegrity(context)) !== true) {
      throw new PreviewGenerationError("RESULT_INTEGRITY_INVALID");
    }
    const risk = evaluateRisk(context.question, context.scene);
    if (risk.status !== "allowed") throw new PreviewGenerationError("RISK_BLOCKED");

    const input: ProviderInput = {
      castingId: context.castingId,
      question: context.question,
      scene: context.scene,
      interpretationGoal: context.interpretationGoal,
      facts: context.facts,
    };
    // The hash is the only persisted representation of this snapshot. The question is kept
    // in memory for the provider call and is never included in a URL or response payload.
    const inputSnapshotHash = hashGenerationSnapshot({
      castingId: context.castingId,
      generationEpoch: context.generationEpoch,
      question: context.question,
      facts: context.facts,
    });
    const deadlineAt = Date.now() + this.timeoutMs;
    const remainingTimeout = (): number => Math.max(0, deadlineAt - Date.now());
    const now = this.now();
    const { job, created } = await this.repository.createOrReuseJob({
      castingId: context.castingId,
      kind: "preview",
      generationEpoch: context.generationEpoch,
      idempotencyKey: request.idempotencyKey,
      inputSnapshotHash,
      timeoutMs: this.timeoutMs,
      now,
    });
    if (job.status === "completed") {
      const result = await this.repository.getPreview(context.castingId);
      return stateResult(job, result ?? undefined);
    }
    if (!created && job.status !== "queued") return stateResult(job);

    const leaseToken = randomUUID();
    const claimed = await this.repository.markJobRunning({
      jobId: job.id,
      leaseToken,
      now,
      leaseExpiresAt: new Date(now.getTime() + this.timeoutMs),
    });
    if (!claimed) {
      const current = await this.repository.getJobStatus(context.castingId);
      if (!current) throw new PreviewGenerationError("GENERATION_JOB_UNAVAILABLE", true);
      return stateResult(current);
    }

    try {
      const providerTimeoutMs = remainingTimeout();
      const generated = await timeoutPromise(
        (signal) => this.provider.generatePreview(input, signal),
        providerTimeoutMs,
        request.signal,
      );
      if (
        this.maxOutputTokens !== undefined
        && generated.tokenUsage?.output !== undefined
        && generated.tokenUsage.output > this.maxOutputTokens
      ) {
        throw new PreviewGenerationError("AI_COST_LIMIT");
      }
      const parsedOutput = previewOutputSchema.safeParse(generated.output);
      if (!parsedOutput.success) throw new PreviewGenerationError("AI_SCHEMA_INVALID");
      const parsedFacts = deterministicFactsSchema.safeParse(generated.deterministicFacts);
      if (!parsedFacts.success) throw new PreviewGenerationError("FACT_CONSISTENCY_FAILURE");
      try {
        deepStrictEqual(parsedFacts.data, context.facts);
      } catch {
        throw new PreviewGenerationError("FACT_CONSISTENCY_FAILURE");
      }
      try {
        validatePreviewSafety(parsedOutput.data);
      } catch {
        throw new PreviewGenerationError("OUTPUT_SAFETY_FAILURE");
      }
      const reviewTimeoutMs = remainingTimeout();
      const review = await timeoutPromise(
        (signal) => this.reviewer.review({ kind: "preview", output: parsedOutput.data, facts: parsedFacts.data }, signal),
        reviewTimeoutMs,
        request.signal,
      );
      if (review.status !== "pass" || !review.schemaValid || !review.safetyPass || !review.factConsistencyPass) {
        throw new PreviewGenerationError("OUTPUT_REVIEW_FAILED");
      }
      if (remainingTimeout() <= 0) throw new PreviewGenerationError("AI_GATEWAY_TIMEOUT", true);
      let result: PreviewResultRecord;
      try {
        result = await this.repository.persistPreviewSuccess({
          jobId: job.id,
          leaseToken,
          generationEpoch: context.generationEpoch,
          inputSnapshotHash,
          output: parsedOutput.data as CommercialPreviewOutput,
          review,
          provider: this.provider.provider,
          model: this.provider.model,
          reviewerModelVersion: this.reviewer.reviewerModel,
          providerRequestId: generated.requestId,
          tokenUsage: generated.tokenUsage,
          costMetadata: generated.costMetadata,
          now: this.now(),
        });
      } catch {
        throw new PreviewGenerationError("PERSISTENCE_FAILED", true);
      }
      return { status: "completed", jobId: job.id, result };
    } catch (error) {
      const classification = classifyGenerationError(error);
      const isTimeout = error instanceof PreviewGenerationError && error.code === "AI_GATEWAY_TIMEOUT";
      const errorCode = error instanceof PreviewGenerationError ? error.code : classification.code;
      const status = isTimeout ? "timed_out" : "failed";
      await this.repository.markJobFailed({
        jobId: job.id,
        leaseToken,
        status,
        errorCode,
        now: this.now(),
      });
      if (error instanceof PreviewGenerationError) throw error;
      throw new PreviewGenerationError(errorCode, classification.retryable);
    }
  }

  async getStatus(request: { castingId: string; userId: string }): Promise<PreviewGenerationResult | { status: "not_started"; jobId: null }> {
    const context = await this.repository.getPreviewContext(request.castingId);
    if (!context || context.userId !== request.userId) throw new PreviewGenerationError("CASTING_NOT_FOUND");
    const job = await this.repository.getJobStatus(request.castingId);
    if (!job) return { status: "not_started", jobId: null };
    const result = job.status === "completed" ? await this.repository.getPreview(request.castingId) : null;
    return stateResult(job, result ?? undefined);
  }
}
