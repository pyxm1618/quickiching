import { runtimeConfig } from "@/server/config";
import { createPostgresPersistence } from "@/server/repositories/postgres";
import { PostgresGenerationJobRepository } from "@/server/repositories/postgres/generation-job-repository";
import { AiSdkGatewayProvider } from "@/server/ai/gateway-provider";
import { GenerationJobService } from "@/server/jobs/generation-job-service";
import { openGenerationSnapshot } from "@/server/jobs/generation-snapshot";
import { structuredLog } from "@/server/observability/log";

async function executeGenerationStep(jobId: string) {
  "use step";
  const config = runtimeConfig();
  if (config.mode !== "production" || config.ai !== "ai-sdk" || config.database !== "postgres") {
    throw new Error("PRODUCTION_GENERATION_CONFIGURATION_REQUIRED");
  }
  const persistence = createPostgresPersistence(config.credentials.databaseUrl);
  const repository = new PostgresGenerationJobRepository(persistence.sql);
  const gateway = new AiSdkGatewayProvider({
    apiKey: config.credentials.aiGatewayApiKey,
    models: {
      preview: config.credentials.aiModelPreview,
      reading: config.credentials.aiModelDeepReading,
      review: config.credentials.aiModelOutputReview,
    },
  });
  const service = new GenerationJobService({
    repository,
    provider: {
      generatePreview: (snapshot) => gateway.generatePreview(openGenerationSnapshot(snapshot)),
      generateReading: (snapshot) => gateway.generateReading(openGenerationSnapshot(snapshot)),
    },
    entitlement: {
      consume: (reservationId) => persistence.atomicRepository.consumeReservation(reservationId, new Date()),
      release: (reservationId, expired) => persistence.atomicRepository.releaseReservation(reservationId, expired, new Date()),
    },
    clock: { now: () => new Date() },
  });
  structuredLog("info", "generation_job_started", { jobId });
  try {
    const result = await service.execute(jobId);
    structuredLog("info", "generation_job_completed", { jobId, ...result });
    return result;
  } catch (error) {
    structuredLog("error", "generation_job_failed", { jobId, error });
    throw error;
  } finally {
    await persistence.close();
  }
}

export async function generationWorkflow(jobId: string) {
  "use workflow";
  return executeGenerationStep(jobId);
}
