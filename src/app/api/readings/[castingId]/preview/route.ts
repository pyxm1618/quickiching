import { z } from "zod";
import { isAiPreviewCapabilityEnabled } from "@/server/generation/capability";
import { createProductionPreviewGenerationService } from "@/server/generation/composition";
import { PreviewGenerationError } from "@/server/generation/preview-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 4 * 1024;
const castingIdSchema = z.string().uuid();
const previewRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(256),
}).strict();

type RouteContext = { params: Promise<{ castingId: string }> };

function responseHeaders(extra: Record<string, string> = {}): Headers {
  return new Headers({
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    ...extra,
  });
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: responseHeaders(extra) });
}

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: responseHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
  });
}

function methodNotAllowed(): Response {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: responseHeaders({ "Allow": "GET, POST", "Content-Type": "text/plain; charset=utf-8" }),
  });
}

function requestOrigin(request: Request): string {
  const configured = process.env.BETTER_AUTH_URL?.trim() || process.env.APP_BASE_URL?.trim();
  try {
    return new URL(configured || request.url).origin;
  } catch {
    return new URL(request.url).origin;
  }
}

function sameOriginRequest(request: Request): boolean {
  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") return false;
  const expectedOrigin = requestOrigin(request);
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== expectedOrigin) return false;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).origin !== expectedOrigin) return false;
    } catch {
      return false;
    }
  }
  return true;
}

async function routeParams(context: RouteContext): Promise<{ castingId: string } | null> {
  const params = await context.params;
  const parsed = castingIdSchema.safeParse(params.castingId);
  return parsed.success ? { castingId: parsed.data } : null;
}

async function authenticatedUser(request: Request): Promise<{ id: string } | null> {
  const { getAuth } = await import("@/server/auth/server");
  const session = await getAuth().api.getSession({ headers: request.headers });
  return session?.user ? { id: session.user.id } : null;
}

function errorStatus(error: PreviewGenerationError): number {
  switch (error.code) {
    case "CASTING_NOT_FOUND":
      return 404;
    case "IDEMPOTENCY_KEY_INVALID":
      return 400;
    case "PREVIEW_NOT_REVEALED":
    case "RISK_BLOCKED":
    case "RESULT_INTEGRITY_INVALID":
      return 409;
    case "AI_GATEWAY_TIMEOUT":
    case "timeout":
      return 504;
    case "rate_limit":
      return 429;
    case "AI_PREVIEW_DISABLED":
      return 404;
    case "AI_SCHEMA_INVALID":
    case "AI_COST_LIMIT":
    case "FACT_CONSISTENCY_FAILURE":
    case "OUTPUT_SAFETY_FAILURE":
    case "OUTPUT_REVIEW_FAILED":
      return 502;
    default:
      return error.retryable ? 503 : 500;
  }
}

function safeServiceError(error: unknown): Response {
  if (error instanceof PreviewGenerationError) {
    return json({ error: error.code, retryable: error.retryable }, errorStatus(error));
  }
  return json({ error: "GENERATION_UNAVAILABLE", retryable: true }, 503);
}

async function withAuthenticatedService(
  request: Request,
  castingId: string,
  callback: (userId: string, service: Awaited<ReturnType<typeof createProductionPreviewGenerationService>>) => Promise<Response>,
): Promise<Response> {
  let user: { id: string } | null;
  try {
    user = await authenticatedUser(request);
  } catch {
    return json({ error: "AUTH_UNAVAILABLE" }, 503);
  }
  if (!user) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const service = await createProductionPreviewGenerationService();
    return await callback(user.id, service);
  } catch (error) {
    return safeServiceError(error);
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  if (!isAiPreviewCapabilityEnabled()) return notFound();
  if (!sameOriginRequest(request)) return json({ error: "CSRF_REJECTED" }, 403);
  const params = await routeParams(context);
  if (!params) return json({ error: "INVALID_REQUEST" }, 400);
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "INVALID_REQUEST" }, 400);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return json({ error: "REQUEST_TOO_LARGE" }, 413);
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return json({ error: "REQUEST_TOO_LARGE" }, 413);
    body = JSON.parse(raw) as unknown;
  } catch {
    return json({ error: "INVALID_REQUEST" }, 400);
  }
  const parsed = previewRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "INVALID_REQUEST" }, 400);

  return withAuthenticatedService(request, params.castingId, async (userId, service) => {
    try {
      const result = await service.generate({
        castingId: params.castingId,
        userId,
        idempotencyKey: parsed.data.idempotencyKey,
        signal: request.signal,
      });
      return json(result);
    } catch (error) {
      return safeServiceError(error);
    }
  });
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  if (!isAiPreviewCapabilityEnabled()) return notFound();
  if (!sameOriginRequest(request)) return json({ error: "CSRF_REJECTED" }, 403);
  const params = await routeParams(context);
  if (!params) return json({ error: "INVALID_REQUEST" }, 400);
  return withAuthenticatedService(request, params.castingId, async (userId, service) => {
    try {
      return json(await service.getStatus({ castingId: params.castingId, userId }));
    } catch (error) {
      return safeServiceError(error);
    }
  });
}

export function PUT(): Promise<Response> {
  return Promise.resolve(methodNotAllowed());
}

export function PATCH(): Promise<Response> {
  return Promise.resolve(methodNotAllowed());
}

export function DELETE(): Promise<Response> {
  return Promise.resolve(methodNotAllowed());
}
