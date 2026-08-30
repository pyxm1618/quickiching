import { z } from "zod";
import { isContentLocale, type ContentLocale } from "@/i18n/config";
import { isCheckoutCapabilityEnabled } from "@/server/payments/capability";
import { CheckoutServiceError } from "@/server/payments/checkout-service";
import { readRequestBody, RequestBodyTooLargeError } from "@/server/http/read-request-body";
import { isStrictSameOriginRequest } from "@/server/http/origin-guard";
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

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: headers(extraHeaders) });
}

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: headers({ "Content-Type": "text/plain; charset=utf-8" }),
  });
}

async function authenticatedUser(request: Request): Promise<{ id: string; email: string } | null> {
  const { getAuth } = await import("@/server/auth/server");
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email };
}

/**
 * Picks the hosted cashier's default language only. Taken from the request
 * because that is where browsing context lives; the buyer can still switch
 * language on the checkout page.
 */
function requestLocale(request: Request): ContentLocale {
  const header = request.headers.get("x-quickiching-locale")?.trim();
  if (header && isContentLocale(header)) return header;

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const [segment] = new URL(referer).pathname.split("/").filter(Boolean);
      if (segment === "zh") return "zh-Hans";
    } catch {
      // A malformed referer simply falls through to the default.
    }
  }
  return "en";
}

function serviceFailure(error: unknown): Response {
  if (error instanceof CheckoutServiceError) {
    const status = error.code === "CHECKOUT_REQUEST_INVALID"
      ? 400
      : error.code === "CHECKOUT_RATE_LIMITED"
        ? 429
        : [
            "CHECKOUT_IDEMPOTENCY_CONFLICT",
            "CHECKOUT_TERMINAL_ORDER",
            "CHECKOUT_EXPIRED",
            "CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN",
          ].includes(error.code)
          ? 409
          : 503;
    const extraHeaders: Record<string, string> = {};
    if (error.code === "CHECKOUT_RATE_LIMITED" && error.retryAfterSeconds) {
      extraHeaders["Retry-After"] = String(error.retryAfterSeconds);
    }
    return json({ error: error.code, retryable: error.retryable }, status, extraHeaders);
  }
  return json({ error: "CHECKOUT_UNAVAILABLE", retryable: true }, 503);
}

export async function POST(request: Request): Promise<Response> {
  if (!isCheckoutCapabilityEnabled()) return notFound();
  if (!isStrictSameOriginRequest(request)) return json({ error: "CSRF_REJECTED" }, 403);
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "INVALID_REQUEST" }, 400);
  }
  const declaredLengthHeader = request.headers.get("content-length");
  if (declaredLengthHeader !== null) {
    const declaredLength = Number(declaredLengthHeader);
    if (!Number.isFinite(declaredLength) || declaredLength < 0) return json({ error: "INVALID_REQUEST" }, 400);
    if (declaredLength > MAX_REQUEST_BYTES) return json({ error: "REQUEST_TOO_LARGE" }, 413);
  }

  let body: unknown;
  try {
    const rawBody = await readRequestBody(request, MAX_REQUEST_BYTES);
    body = JSON.parse(rawBody) as unknown;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return json({ error: "REQUEST_TOO_LARGE" }, 413);
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
      locale: requestLocale(request),
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
