import { timingSafeEqual } from "node:crypto";
import { dispatchGenerationOutbox } from "@/server/jobs/generation-dispatcher";
import { getProductionRuntime } from "@/server/runtime/production";
import { loadCronSecret } from "@/server/cron-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const expected = loadCronSecret();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const production = await getProductionRuntime();
  const [dispatch, timedOut, rateLimitBucketsPurged, accountContent] = await Promise.all([
    dispatchGenerationOutbox(25),
    production.generation.reconcileTimeouts(new Date()),
    production.rateLimiter.purgeExpired(new Date()),
    production.accountPrivacy.purgeDue(25),
  ]);
  return Response.json({
    dispatched: dispatch.dispatched,
    skipped: dispatch.skipped,
    timedOut: timedOut.length,
    rateLimitBucketsPurged,
    accountContentPurged: accountContent.purged,
  }, {
    headers: { "cache-control": "no-store" },
  });
}
