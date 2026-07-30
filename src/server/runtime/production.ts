import postgres, { type Sql } from "postgres";
import { migratePostgres } from "@/server/db/migrate";
import { runtimeConfig } from "@/server/config";
import { PostgresApplicationRuntime } from "./postgres-application";
import { PostgresGenerationRepository } from "@/server/repositories/postgres/generation-repository";
import { PostgresRateLimiter, TurnstileVerifier } from "@/server/security/abuse-controls";

export type ProductionRuntime = {
  sql: Sql;
  application: PostgresApplicationRuntime;
  generation: PostgresGenerationRepository;
  rateLimiter: PostgresRateLimiter;
  turnstile: TurnstileVerifier;
};

type ProductionGlobal = typeof globalThis & {
  __ICHING_PRODUCTION_RUNTIME__?: Promise<ProductionRuntime>;
};

function secureRandomInt(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) throw new Error("RANDOM_BOUND_INVALID");
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] % maxExclusive;
}

async function createProductionRuntime(): Promise<ProductionRuntime> {
  const config = runtimeConfig();
  if (config.mode !== "production" || config.database !== "postgres") {
    throw new Error("PRODUCTION_RUNTIME_NOT_ENABLED");
  }
  const sql = postgres(config.credentials.databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: true,
  });
  await migratePostgres(sql);
  return {
    sql,
    application: new PostgresApplicationRuntime({
      sql,
      clock: { now: () => new Date() },
      random: {
        randomBit: () => secureRandomInt(2) === 1,
        randomInt: secureRandomInt,
      },
    }),
    generation: new PostgresGenerationRepository(sql),
    rateLimiter: new PostgresRateLimiter(sql),
    turnstile: new TurnstileVerifier({ secret: config.credentials.turnstileSecretKey }),
  };
}

export function getProductionRuntime(): Promise<ProductionRuntime> {
  const globalRef = globalThis as ProductionGlobal;
  globalRef.__ICHING_PRODUCTION_RUNTIME__ ??= createProductionRuntime();
  return globalRef.__ICHING_PRODUCTION_RUNTIME__;
}
