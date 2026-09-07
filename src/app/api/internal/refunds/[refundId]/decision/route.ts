import { z } from "zod";
import { readRequestBody, RequestBodyTooLargeError } from "@/server/http/read-request-body";
import { createProductionRefundRepository } from "@/server/refunds/composition";
import { verifyRefundOperatorAuthorization } from "@/server/refunds/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 4 * 1024;
const refundIdSchema = z.string().uuid();
const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(1000).optional(),
}).strict();
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
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "INVALID_REQUEST" }, 400);
  }

  let body: unknown;
  try {
    body = JSON.parse(await readRequestBody(request, MAX_REQUEST_BYTES)) as unknown;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return json({ error: "REQUEST_TOO_LARGE" }, 413);
    return json({ error: "INVALID_REQUEST" }, 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return json({ error: "INVALID_REQUEST" }, 400);

  try {
    const repository = createProductionRefundRepository();
    const result = await repository.decide({
      refundId: id,
      action: parsed.data.action,
      operatorId: "refund-operator",
      ...(parsed.data.note ? { note: parsed.data.note } : {}),
      now: new Date(),
    });
    return json({ refundId: result.id, orderId: result.orderId, status: result.status });
  } catch (error) {
    const code = error instanceof Error ? error.message : "REFUND_DECISION_UNAVAILABLE";
    if (code === "REFUND_INTENT_NOT_FOUND") return json({ error: code }, 404);
    if (code === "REFUND_DECISION_INVALID") return json({ error: code }, 400);
    if (code === "REFUND_DECISION_CONFLICT" || code === "REFUND_MANUAL_EXCEPTION_REQUIRES_POLICY_DECISION") {
      return json({ error: code }, 409);
    }
    return json({ error: "REFUND_DECISION_UNAVAILABLE", retryable: true }, 503);
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
