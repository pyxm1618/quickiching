export async function register(): Promise<void> {
  // Next builds instrumentation for both Node.js and Edge runtimes. Keep the
  // Node-only configuration module out of the Edge module graph while still
  // failing closed when the Node.js server runtime starts.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateRuntimeConfig } = await import("@/server/config");
    validateRuntimeConfig();
  }
}
