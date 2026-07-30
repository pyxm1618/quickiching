import { start } from "workflow/api";
import { runtimeConfig } from "@/server/config";
import { createPostgresPersistence } from "@/server/repositories/postgres";
import { PostgresGenerationJobRepository } from "@/server/repositories/postgres/generation-job-repository";
import { generationWorkflow } from "@/server/workflows/generation";
import { structuredLog } from "@/server/observability/log";

export async function dispatchGenerationOutbox(limit = 10): Promise<{
  claimed: number;
  dispatched: number;
}> {
  const config = runtimeConfig();
  if (config.mode !== "production" || config.database !== "postgres" || config.workflow !== "vercel") {
    throw new Error("PRODUCTION_WORKFLOW_CONFIGURATION_REQUIRED");
  }
  const persistence = createPostgresPersistence(config.credentials.databaseUrl);
  const repository = new PostgresGenerationJobRepository(persistence.sql);
  let dispatched = 0;
  try {
    const messages = await repository.claimOutbox(limit, new Date());
    for (const message of messages) {
      try {
        const run = await start(generationWorkflow, [message.jobId]);
        await repository.markOutboxDispatched(message.id, message.jobId, run.runId, new Date());
        dispatched++;
        structuredLog("info", "generation_outbox_dispatched", {
          messageId: message.id,
          jobId: message.jobId,
          workflowRunId: run.runId,
          attempt: message.attempts,
        });
      } catch (error) {
        await repository.releaseOutbox(message.id, new Date());
        structuredLog("error", "generation_outbox_dispatch_failed", {
          messageId: message.id,
          jobId: message.jobId,
          error,
        });
      }
    }
    return { claimed: messages.length, dispatched };
  } finally {
    await persistence.close();
  }
}
