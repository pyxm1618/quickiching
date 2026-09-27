const url = "https://www.quickiching.com/api/ready";

async function main() {
  const response = await fetch(`${url}?release_check=${Date.now()}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => null);
  const ready = response.status === 200 && body?.status === "ready" && body?.overall === "ready";
  if (!ready) {
    const status = typeof body?.status === "string" ? body.status : "invalid_response";
    const overall = typeof body?.overall === "string" ? body.overall : "unknown";
    throw new Error(`PRODUCTION_SCHEMA_NOT_READY:http=${response.status}:status=${status}:overall=${overall}`);
  }
  console.log("Production /api/ready reports status=ready and overall=ready.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "PRODUCTION_SCHEMA_READINESS_CHECK_FAILED");
  process.exitCode = 1;
});
