import { randomUUID } from "node:crypto";
import { createProductionAiAdapter } from "@/server/ai/ai-sdk-adapter";
import { getProductionRuntime } from "@/server/runtime/production";
import { createStructuredLogger } from "@/server/observability/structured-logger";

function errorCode(error: unknown): string {
  if (!(error instanceof Error)) return "GENERATION_UNKNOWN_ERROR";
  const bounded = error.message.split(":", 1)[0].replace(/[^A-Z0-9_]/gi, "_").toUpperCase();
  return bounded.slice(0, 80) || "GENERATION_ERROR";
}

function retryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const candidate = error as Error & { statusCode?: number };
  return candidate.name === "AbortError"
    || /timeout/i.test(candidate.message)
    || candidate.statusCode === 429
    || (candidate.statusCode != null && candidate.statusCode >= 500);
}

export async function executeGenerationJob(input: {
  jobId: string;
  generationEpoch: number;
}): Promise<{ status: "completed" | "failed" | "ignored"; code?: string }> {
  const runtime = await getProductionRuntime();
  const workerId = `workflow_${randomUUID()}`;
  const claimed = await runtime.sql.begin(async (tx) => {
    const rows = await tx`
      update generation_jobs set
        status = 'running', attempts = attempts + 1, claimed_at = now(),
        worker_id = ${workerId}, updated_at = now()
      where id = ${input.jobId}
        and generation_epoch = ${input.generationEpoch}
        and status = 'queued'
        and timeout_at > now()
      returning *
    `;
    const job = rows[0];
    if (!job) return false;
    const modelId = job.job_type === "preview"
      ? "configured-preview-model"
      : "configured-deep-reading-model";
    await tx`
      insert into generation_attempts (
        id, job_id, generation_epoch, attempt_number, model_id, prompt_version,
        schema_version, status, started_at
      ) values (
        ${`att_${randomUUID().replaceAll("-", "")}`}, ${job.id}, ${job.generation_epoch},
        ${job.attempts}, ${modelId}, 'reading-prompt-v2.1',
        ${job.job_type === "preview" ? "preview-v1" : "reading-v1"}, 'running', now()
      )
    `;
    return true;
  });
  if (!claimed) return { status: "ignored" };

  const job = await runtime.generation.getJob(input.jobId, input.generationEpoch);
  if (!job || job.status !== "running") return { status: "ignored" };
  const logger = createStructuredLogger({ environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown" });
  const adapter = await createProductionAiAdapter();

  try {
    if (job.jobType === "preview") {
      const generated = await adapter.generatePreview(job.snapshot.input, {
        userId: job.snapshot.userId,
        jobId: job.id,
        epoch: job.generationEpoch,
        attempt: job.attempts,
      });
      const finalized = await runtime.generation.finalizePreview({
        jobId: job.id,
        generationEpoch: job.generationEpoch,
        output: generated.output,
        providerRequestId: generated.providerRequestId,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        latencyMs: generated.latencyMs,
        now: new Date(),
      });
      if (!finalized.accepted) return { status: "ignored", code: finalized.code };
    } else {
      const generated = await adapter.generateReading(job.snapshot.input, {
        userId: job.snapshot.userId,
        jobId: job.id,
        epoch: job.generationEpoch,
        attempt: job.attempts,
      });
      const finalized = await runtime.generation.finalizeReading({
        jobId: job.id,
        generationEpoch: job.generationEpoch,
        output: generated.output as unknown as Record<string, unknown>,
        providerRequestId: generated.providerRequestId,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        latencyMs: generated.latencyMs,
        now: new Date(),
      });
      if (!finalized.accepted) return { status: "ignored", code: finalized.code };
    }
    logger.info("generation_completed", {
      jobId: job.id,
      castingId: job.castingId,
      generationEpoch: job.generationEpoch,
      jobType: job.jobType,
    });
    return { status: "completed" };
  } catch (error) {
    const code = errorCode(error);
    await runtime.generation.failAttempt({
      jobId: job.id,
      generationEpoch: job.generationEpoch,
      errorCode: code,
      retryable: retryable(error),
      now: new Date(),
    });
    logger.error("generation_failed", {
      jobId: job.id,
      castingId: job.castingId,
      generationEpoch: job.generationEpoch,
      jobType: job.jobType,
      error,
      code,
    });
    return { status: "failed", code };
  }
}
