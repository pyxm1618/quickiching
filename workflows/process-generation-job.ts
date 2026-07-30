import { executeGenerationJob } from "@/server/jobs/generation-worker";

export async function processGenerationJob(
  jobId: string,
  generationEpoch: number,
): Promise<{ status: "completed" | "failed" | "ignored"; code?: string }> {
  "use workflow";
  return runGenerationStep(jobId, generationEpoch);
}

async function runGenerationStep(
  jobId: string,
  generationEpoch: number,
): Promise<{ status: "completed" | "failed" | "ignored"; code?: string }> {
  "use step";
  return executeGenerationJob({ jobId, generationEpoch });
}
