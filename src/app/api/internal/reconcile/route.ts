import { timingSafeEqual } from "node:crypto";
import { isReconcileCapabilityEnabled } from "@/server/reconcile/capability";
import { createProductionReconcileService } from "@/server/reconcile/composition";
import { getServerConfig } from "@/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function headers(extra: Record<string, string> = {}): Headers {
  return new Headers({
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    ...extra,
  });
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: headers() });
}

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: headers({ "Content-Type": "text/plain; charset=utf-8" }),
  });
}

function unauthorized(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: headers({ "Content-Type": "text/plain; charset=utf-8" }),
  });
}

function verifyCronAuthorization(request: Request, expectedSecret: string): boolean {
  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const provided = authHeader.slice(7).trim();
  if (!provided || !expectedSecret) return false;

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expectedSecret);
  if (providedBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(providedBuf, expectedBuf);
}

export async function GET(request: Request): Promise<Response> {
  if (!isReconcileCapabilityEnabled()) return notFound();

  const config = getServerConfig();
  const cronSecret = config.cronSecret ?? process.env.CRON_SECRET ?? "";
  if (!verifyCronAuthorization(request, cronSecret)) {
    return unauthorized();
  }

  try {
    const service = await createProductionReconcileService();
    const metrics = await service.runReconcile();
    return json(metrics, 200);
  } catch (error) {
    return json({ error: "RECONCILE_FAILED", retryable: true }, 500);
  }
}

function methodNotAllowed(): Promise<Response> {
  return Promise.resolve(new Response("Method Not Allowed", {
    status: 405,
    headers: headers({ "Allow": "GET", "Content-Type": "text/plain; charset=utf-8" }),
  }));
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
