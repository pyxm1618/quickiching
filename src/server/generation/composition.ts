import { resolveCommercialCapabilities } from "@/server/capabilities";
import { getCommercialDatabaseConnection } from "@/server/db/client";
import { createAiSdkGenerationProvider, createAiSdkOutputReviewer } from "./ai-sdk-provider";
import { createResultIntegrityVerifier } from "./integrity";
import { PostgresPreviewGenerationRepository } from "./postgres-repository";
import { PreviewGenerationService } from "./preview-service";

type RuntimeEnv = Record<string, string | undefined>;

function positiveInteger(env: RuntimeEnv, name: string): number {
  const value = env[name]?.trim();
  if (!value || !/^\d+$/.test(value)) throw new Error("AI_ADAPTER_CONFIGURATION_UNAVAILABLE");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error("AI_ADAPTER_CONFIGURATION_UNAVAILABLE");
  return parsed;
}

/**
 * The only CP3 production composition. It deliberately has no local, memory,
 * simulated-provider, or legacy Public V1 fallback.
 */
export async function createProductionPreviewGenerationService(
  env: RuntimeEnv = process.env,
): Promise<PreviewGenerationService> {
  const capabilities = resolveCommercialCapabilities(env);
  if (!capabilities.capabilities.aiPreview.enabled) {
    throw new Error("AI_PREVIEW_DISABLED");
  }
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("COMMERCIAL_DATABASE_UNAVAILABLE");

  const [{ client }, provider, reviewer] = await Promise.all([
    Promise.resolve(getCommercialDatabaseConnection(databaseUrl)),
    createAiSdkGenerationProvider(env),
    createAiSdkOutputReviewer(env),
  ]);

  return new PreviewGenerationService({
    repository: new PostgresPreviewGenerationRepository(client, env),
    provider,
    reviewer,
    maxOutputTokens: positiveInteger(env, "AI_MAX_OUTPUT_TOKENS"),
    verifyResultIntegrity: createResultIntegrityVerifier(env),
  });
}
