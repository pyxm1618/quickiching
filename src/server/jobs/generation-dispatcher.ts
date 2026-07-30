import { start } from "workflow/api";
import { processGenerationJob } from "@/workflows/process-generation-job";
import { getProductionRuntime } from "@/server/runtime/production";

export async function dispatchGenerationOutbox(limit = 25): Promise<{
  dispatched: number;
  skipped: number;
}> {
  const runtime = await getProductionRuntime();
  const events = await runtime.generation.listUndispatchedOutbox(limit);
  let dispatched = 0;
  let skipped = 0;

  for (const event of events) {
    const job = await runtime.generation.getJob(event.jobId, event.generationEpoch);
    if (!job || !["queued", "running"].includes(job.status)) {
      await runtime.generation.markOutboxDispatched({ outboxId: event.id, now: new Date() });
      skipped++;
      continue;
    }
    if (job.workflowRunId) {
      await runtime.generation.markOutboxDispatched({ outboxId: event.id, now: new Date() });
      skipped++;
      continue;
    }

    const run = await start(processGenerationJob, [event.jobId, event.generationEpoch]);
    const recorded = await runtime.generation.markWorkflowRun({
      jobId: event.jobId,
      generationEpoch: event.generationEpoch,
      workflowRunId: run.runId,
      now: new Date(),
    });
    if (!recorded) {
      skipped++;
      continue;
    }
    await runtime.generation.markOutboxDispatched({ outboxId: event.id, now: new Date() });
    dispatched++;
  }

  return { dispatched, skipped };
}
