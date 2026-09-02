import { resolveCommercialCapabilities } from "@/server/capabilities";
import { getCommercialDatabaseConnection } from "@/server/db/client";
import { createPostgresCastingRepository, type PostgresCastingRepository } from "./postgres-repository";

type RuntimeEnv = Record<string, string | undefined>;

/**
 * The only production composition for claiming a browser cast. Like the other
 * commercial areas it has no memory or simulated fallback: with the capability
 * closed there is no repository to hand back.
 */
export async function createProductionCastingRepository(
  env: RuntimeEnv = process.env,
): Promise<PostgresCastingRepository> {
  const capabilities = resolveCommercialCapabilities(env, { production: env.NODE_ENV === "production" });
  if (!capabilities.capabilities.paidDeepReading.enabled) {
    throw new Error("PAID_DEEP_READING_DISABLED");
  }
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("COMMERCIAL_DATABASE_UNAVAILABLE");

  const { client } = getCommercialDatabaseConnection(databaseUrl);
  return createPostgresCastingRepository({ sql: client, env });
}
