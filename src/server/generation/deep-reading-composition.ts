import { getPostgresClient } from "@/server/db/client";
import { createWorkflowStarter } from "@/server/workflows/workflow-starter";
import { createDeepReadingService, type DeepReadingService } from "./deep-reading-service";

let cachedService: DeepReadingService | null = null;

export async function createProductionDeepReadingService(): Promise<DeepReadingService> {
  if (cachedService) return cachedService;

  const sql = getPostgresClient();
  const workflowStarter = createWorkflowStarter();
  cachedService = createDeepReadingService({ sql, workflowStarter });
  return cachedService;
}
