import { validateRuntimeConfig } from "@/server/config";

export async function register(): Promise<void> {
  // Next invokes instrumentation when the server runtime starts, not while static
  // modules are being analyzed. The local MVP is intentionally unable to boot as
  // a production deployment until real adapters are supplied.
  if (process.env.NEXT_RUNTIME === "nodejs") validateRuntimeConfig();
}
