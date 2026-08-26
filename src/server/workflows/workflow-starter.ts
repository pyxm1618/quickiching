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

      // 1. Record workflow_runs in database with status start_pending
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
          set provider_run_id = ${run.runId ?? runId},
              status = 'pending',
              updated_at = clock_timestamp()
          where idempotency_key = ${input.idempotencyKey}
        `;

        return { runId: run.runId ?? runId, started: true };
      } catch (error) {
        // Start failed or threw an uncertain outcome:
        // Do NOT immediately delete reservation or blindly retry.
        // Record the error on workflow_runs, keep start_pending status,
        // and allow Reconcile to safely recover or release after grace period.
        const errorCode = error instanceof Error ? error.message : "WORKFLOW_START_FAILED";
        await sql`
          update workflow_runs
          set error_code = ${errorCode},
              updated_at = clock_timestamp()
          where idempotency_key = ${input.idempotencyKey}
        `;

        return { runId, started: false };
      }
    },
  };
}
