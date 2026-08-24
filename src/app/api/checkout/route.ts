import { z } from "zod";
import { isCheckoutCapabilityEnabled } from "@/server/payments/capability";
import { CheckoutServiceError } from "@/server/payments/checkout-service";
import { createProductionCheckoutService } from "@/server/payments/composition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 4 * 1024;
const bodySchema = z.object({
  productKey: z.enum(["one", "three", "five"]),
  requestId: z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/),
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

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: headers({ "Content-Type": "text/plain; charset=utf-8" }),
  });
}

function sameOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const configured = process.env.APP_BASE_URL?.trim() || process.env.BETTER_AUTH_URL?.trim() || request.url;
  try {
    return new URL(origin).origin === new URL(configured).origin;
  } catch {
    return false;
  }
}

async function authenticatedUser(request: Request): Promise<{ id: string; email: string } | null> {
  const { getAuth } = await import("@/server/auth/server");
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email };
}

function serviceFailure(error: unknown): Response {
  if (error instanceof CheckoutServiceError) {
    const status = error.code === "CHECKOUT_REQUEST_INVALID"
      ? 400
      : error.code === "CHECKOUT_IDEMPOTENCY_CONFLICT" ? 409 : 503;
    return json({ error: error.code, retryable: error.retryable }, status);
  }
  return json({ error: "CHECKOUT_UNAVAILABLE", retryable: true }, 503);
}

export async function POST(request: Request): Promise<Response> {
  if (!isCheckoutCapabilityEnabled()) return notFound();
  if (!sameOrigin(request)) return json({ error: "CSRF_REJECTED" }, 403);
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "INVALID_REQUEST" }, 400);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(declaredLength) || declaredLength < 0) return json({ error: "INVALID_REQUEST" }, 400);
  if (declaredLength > MAX_REQUEST_BYTES) return json({ error: "REQUEST_TOO_LARGE" }, 413);

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return json({ error: "REQUEST_TOO_LARGE" }, 413);
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return json({ error: "INVALID_REQUEST" }, 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return json({ error: "INVALID_REQUEST" }, 400);

  let user: { id: string; email: string } | null;
  try {
    user = await authenticatedUser(request);
  } catch {
    return json({ error: "AUTH_UNAVAILABLE" }, 503);
  }
  if (!user) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const service = await createProductionCheckoutService();
    const checkout = await service.create({
      userId: user.id,
      buyerEmail: user.email,
      ...parsed.data,
    });
    return json({
      orderId: checkout.orderId,
      checkoutUrl: checkout.checkoutUrl,
      expiresAt: checkout.expiresAt.toISOString(),
    });
  } catch (error) {
    return serviceFailure(error);
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
