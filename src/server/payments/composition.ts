import { getCommercialDatabaseConnection } from "@/server/db/client";
import { isCheckoutCapabilityEnabled, isWebhookIngestionCapabilityEnabled } from "./capability";
import { createCheckoutService } from "./checkout-service";
import { PostgresPaymentRepository } from "./postgres-repository";
import {
  createWaffoPaymentAdapter,
  resolveWaffoRuntimeConfig,
  resolveWaffoWebhookConfig,
} from "./waffo-adapter";
import { verifyAndNormalizeWaffoWebhook } from "./waffo-webhook";
import { createWaffoWebhookService } from "./webhook-service";

type RuntimeEnv = Record<string, string | undefined>;

function databaseUrl(env: RuntimeEnv): string {
  const value = env.DATABASE_URL?.trim();
  if (!value) throw new Error("COMMERCIAL_DATABASE_UNAVAILABLE");
  return value;
}

export async function createProductionCheckoutService(env: RuntimeEnv = process.env) {
  if (!isCheckoutCapabilityEnabled(env)) throw new Error("CHECKOUT_DISABLED");
  const config = resolveWaffoRuntimeConfig(env);
  const { client } = getCommercialDatabaseConnection(databaseUrl(env));
  return createCheckoutService({
    repository: new PostgresPaymentRepository(client),
    provider: createWaffoPaymentAdapter(config),
    environment: config.environment,
    productIds: config.productIds,
  });
}

export async function createProductionWaffoWebhookService(env: RuntimeEnv = process.env) {
  if (!isWebhookIngestionCapabilityEnabled(env)) throw new Error("WEBHOOK_INGESTION_DISABLED");
  const config = resolveWaffoWebhookConfig(env);
  const { client } = getCommercialDatabaseConnection(databaseUrl(env));
  return createWaffoWebhookService({
    repository: new PostgresPaymentRepository(client),
    verifyAndNormalize: (rawBody, signature) => verifyAndNormalizeWaffoWebhook(rawBody, signature, config),
  });
}
