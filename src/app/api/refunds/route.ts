import { z } from "zod";
import { readRequestBody, RequestBodyTooLargeError } from "@/server/http/read-request-body";
import { isStrictSameOriginRequest } from "@/server/http/origin-guard";
import { createProductionRefundRepository } from "@/server/refunds/composition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 8 * 1024;
const bodySchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000),
}).strict();

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

async function authenticatedUser(request: Request): Promise<{ id: string } | null> {
  const { getAuth } = await import("@/server/auth/server");
  const session = await getAuth().api.getSession({ headers: request.headers });
  return session?.user ? { id: session.user.id } : null;
}

function failure(error: unknown): Response {
  const code = error instanceof Error ? error.message : "REFUND_UNAVAILABLE";
  if (code === "REFUND_REQUEST_INVALID") return json({ error: code }, 400);
  if (code === "REFUND_ORDER_NOT_FOUND") return json({ error: code }, 404);
  if (code === "REFUND_ENTITLEMENT_SOURCE_UNAVAILABLE" || code === "REFUND_INTENT_UNAVAILABLE") {
    return json({ error: code }, 409);
  }
  return json({ error: "REFUND_UNAVAILABLE", retryable: true }, 503);
}

export async function POST(request: Request): Promise<Response> {
  if (!isStrictSameOriginRequest(request)) return json({ error: "CSRF_REJECTED" }, 403);
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "INVALID_REQUEST" }, 400);
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const value = Number(declaredLength);
    if (!Number.isFinite(value) || value < 0) return json({ error: "INVALID_REQUEST" }, 400);
    if (value > MAX_REQUEST_BYTES) return json({ error: "REQUEST_TOO_LARGE" }, 413);
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

  let user: { id: string } | null;
  try {
    user = await authenticatedUser(request);
  } catch {
    return json({ error: "AUTH_UNAVAILABLE" }, 503);
  }
  if (!user) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const repository = createProductionRefundRepository();
    const intent = await repository.apply({
      userId: user.id,
      orderId: parsed.data.orderId,
      reason: parsed.data.reason,
      now: new Date(),
    });
    return json({
      refundId: intent.id,
      orderId: intent.orderId,
      status: intent.status,
      autoScreen: intent.autoScreen,
      screenReason: intent.screenReason,
    }, intent.created ? 201 : 200);
  } catch (error) {
    return failure(error);
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
