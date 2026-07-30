import { timingSafeEqual } from "node:crypto";
import { dispatchGenerationOutbox } from "@/server/jobs/generation-dispatcher";
import { getProductionRuntime } from "@/server/runtime/production";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const production = await getProductionRuntime();
  const [dispatch, timedOut, rateLimitBucketsPurged] = await Promise.all([
    dispatchGenerationOutbox(25),
    production.generation.reconcileTimeouts(new Date()),
    production.rateLimiter.purgeExpired(new Date()),
  ]);
  return Response.json({
    dispatched: dispatch.dispatched,
    skipped: dispatch.skipped,
    timedOut: timedOut.length,
    rateLimitBucketsPurged,
  }, {
    headers: { "cache-control": "no-store" },
  });
}
