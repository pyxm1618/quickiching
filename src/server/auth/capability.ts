import {
  resolveCommercialCapabilities,
  type CommercialCapabilityStatus,
} from "@/server/capabilities";

export function authCapabilityStatus(
  env: Record<string, string | undefined> = process.env,
): CommercialCapabilityStatus | null {
  try {
    return resolveCommercialCapabilities(env).capabilities.auth;
  } catch {
    // Middleware and the auth route must fail closed if a capability flag is
    // malformed; startup validation still reports the actionable config error.
    return null;
  }
}

export function isAuthCapabilityEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return authCapabilityStatus(env)?.enabled === true;
}
