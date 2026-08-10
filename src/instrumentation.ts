import { validateRuntimeConfig } from "@/server/config";

export async function register(): Promise<void> {
  // Public SEO V1 is intentionally credential-free: its indexable pages and browser-only
  // casting tools must be able to run in a production Next server without initializing the
  // future Commercial V2 auth/database/AI/payment stack.
  //
  // Commercial V2 remains fail-closed. When that runtime is explicitly enabled, production
  // configuration is validated at process startup; and any production code path that calls
  // runtimeConfig()/validateRuntimeConfig() without valid credentials still fails closed.
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.COMMERCIAL_V2_RUNTIME_ENABLED === "1"
  ) {
    validateRuntimeConfig();
  }
}
