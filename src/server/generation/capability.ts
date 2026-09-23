import {
  resolveCommercialCapabilities,
  type CommercialCapabilityStatus,
} from "@/server/capabilities";

export function aiPreviewCapabilityStatus(
  env: Record<string, string | undefined> = process.env,
): CommercialCapabilityStatus | null {
  try {
    return resolveCommercialCapabilities(env, { production: env.NODE_ENV === "production" }).capabilities.aiPreview;
  } catch {
    // Request-time gates fail closed. Startup validation remains responsible for
    // reporting the actionable configuration error to operators.
    return null;
  }
}

export function isAiPreviewCapabilityEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return aiPreviewCapabilityStatus(env)?.enabled === true;
}
