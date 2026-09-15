import { resolveCommercialCapabilities } from "@/server/capabilities";

export function isPaidDeepReadingCapabilityEnabled(): boolean {
  return resolveCommercialCapabilities().capabilities.paidDeepReading.enabled;
}
