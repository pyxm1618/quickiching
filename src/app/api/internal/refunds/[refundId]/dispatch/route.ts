import { z } from "zod";
import { createProductionRefundCommandService } from "@/server/refunds/composition";
import { verifyRefundOperatorAuthorization } from "@/server/refunds/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const refundIdSchema = z.string().uuid();
type RouteContext = { params: Promise<{ refundId: string }> };

function headers(extra: Record<string, string> = {}): Headers {
  return new Headers({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", ...extra });
}
function json(body: unknown, status = 200): Response { return Response.json(body, { status, headers: headers() }); }
function notFound(): Response {
  return new Response("Not Found", { status: 404, headers: headers({ "Content-Type": "text/plain; charset=utf-8" }) });
}
function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401, headers: headers({ "Content-Type": "text/plain; charset=utf-8" }) });
}

async function refundId(context: RouteContext): Promise<string | null> {
  const parsed = refundIdSchema.safeParse((await context.params).refundId);
  return parsed.success ? parsed.data : null;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const secret = process.env.REFUND_OPERATOR_SECRET?.trim() ?? "";
  if (!secret) return notFound();
  if (!verifyRefundOperatorAuthorization(request, secret)) return unauthorized();
  const id = await refundId(context);
  if (!id) return json({ error: "INVALID_REQUEST" }, 400);

  try {
    const service = createProductionRefundCommandService();
    const result = await service.execute(id);
    return json({ refundId: id, outcome: result.outcome });
  } catch (error) {
    const code = error instanceof Error ? error.message : "REFUND_DISPATCH_UNAVAILABLE";
    if (code === "REFUND_INTENT_NOT_FOUND") return json({ error: code }, 404);
    if (
      code === "REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE"
      || code === "REFUND_ORDER_STATE_INVALID"
      || code === "REFUND_PROVIDER_WRITE_STATE_CONFLICT"
    ) {
      return json({ error: code }, 409);
    }
    if (code === "REFUND_PROVIDER_WRITE_NOT_DISPATCHED") {
      return json({
        error: code,
        providerWriteDispatched: false,
        retryProviderWrite: true,
      }, 503);
    }
    if (code === "REFUND_PROVIDER_REJECTED") {
      return json({
        error: code,
        providerRejected: true,
        retryProviderWrite: false,
      }, 422);
    }
    if (code === "REFUND_PROVIDER_WRITE_OUTCOME_UNKNOWN") {
      return json({ error: code, reconciliationRequired: true, retryProviderWrite: false }, 503);
    }
    return json({ error: "REFUND_DISPATCH_UNAVAILABLE", retryable: false }, 503);
  }
}

function methodNotAllowed(): Promise<Response> {
  return Promise.resolve(new Response("Method Not Allowed", {
    status: 405,
    headers: headers({ "Allow": "POST", "Content-Type": "text/plain; charset=utf-8" }),
  }));
}
export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
