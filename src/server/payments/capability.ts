import {
  resolveCommercialCapabilities,
  type CommercialCapabilityStatus,
} from "@/server/capabilities";

type RuntimeEnv = Record<string, string | undefined>;

function paymentCapabilityStatus(
  capability: "checkout" | "webhookIngestion",
  env: RuntimeEnv,
): CommercialCapabilityStatus | null {
  try {
    return resolveCommercialCapabilities(env, { production: env.NODE_ENV === "production" }).capabilities[capability];
  } catch {
    return null;
  }
}

export function checkoutCapabilityStatus(env: RuntimeEnv = process.env): CommercialCapabilityStatus | null {
  return paymentCapabilityStatus("checkout", env);
}

export function webhookIngestionCapabilityStatus(env: RuntimeEnv = process.env): CommercialCapabilityStatus | null {
  return paymentCapabilityStatus("webhookIngestion", env);
}

export function isCheckoutCapabilityEnabled(env: RuntimeEnv = process.env): boolean {
  return checkoutCapabilityStatus(env)?.enabled === true;
}

export function isWebhookIngestionCapabilityEnabled(env: RuntimeEnv = process.env): boolean {
  return webhookIngestionCapabilityStatus(env)?.enabled === true;
}
