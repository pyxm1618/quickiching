import { resolveCommercialCapabilities } from "@/server/capabilities";

export function isReconcileCapabilityEnabled(): boolean {
  return resolveCommercialCapabilities().capabilities.reconcile.enabled;
}
