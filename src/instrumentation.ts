import { validateRuntimeConfig } from "@/server/config";

export async function register(): Promise<void> {
  // Public SEO V1 is intentionally credential-free: its indexable pages and browser-only
  // casting tools must be able to run in a production Next server without initializing the
  // future Commercial V2 auth/database/AI/payment stack.
  //
  // The server-side capability matrix is always validated at process startup. It does not
  // require commercial credentials while capabilities are disabled, and it rejects invalid
  // provider targets instead of silently selecting a local/dev/simulated fallback.
  if (process.env.NEXT_RUNTIME === "nodejs") validateRuntimeConfig();
}
