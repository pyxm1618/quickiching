import { randomUUID } from "node:crypto";
import { start } from "workflow/api";
import { getPostgresClient } from "@/server/db/client";
import { deepReadingWorkflow, type DeepReadingWorkflowInput } from "./deep-reading-workflow";

export interface WorkflowStarter {
  startDeepReadingWorkflow(input: DeepReadingWorkflowInput): Promise<{
    runId: string;
    started: boolean;
  }>;
}

export function createWorkflowStarter(): WorkflowStarter {
  return {
    async startDeepReadingWorkflow(input) {
      const sql = getPostgresClient();
      const runId = `wf-${randomUUID()}`;

      await sql`
        insert into workflow_runs (
          id, workflow_name, idempotency_key, entity_type, entity_id, status, created_at, updated_at
        ) values (
          ${runId}, 'deepReadingWorkflow', ${input.idempotencyKey}, 'casting_session', ${input.castingId},
          'start_pending', clock_timestamp(), clock_timestamp()
        ) on conflict (idempotency_key) do nothing
      `;

      try {
        const run = await start(deepReadingWorkflow, [input]);
        await sql`
          update workflow_runs
          set provider_run_id = ${run.runId ?? runId}, status = 'pending',
              error_code = null, updated_at = clock_timestamp()
          where idempotency_key = ${input.idempotencyKey}
        `;
        return { runId: run.runId ?? runId, started: true };
      } catch {
        // The caller performs a fenced compensation only while the job is
        // still queued. Never leak provider details into durable error codes.
        await sql`
          update workflow_runs
          set error_code = 'WORKFLOW_START_FAILED', updated_at = clock_timestamp()
          where idempotency_key = ${input.idempotencyKey}
        `;
        throw new Error("WORKFLOW_START_FAILED");
      }
    },
  };
}
