import { isContentLocale, type ContentLocale } from "@/i18n/config";
import { isPaidDeepReadingCapabilityEnabled } from "@/server/generation/deep-reading-capability";
import { createProductionDeepReadingService } from "@/server/generation/deep-reading-composition";
import { resolveSession } from "@/lib/auth/session";
import { isStrictSameOriginRequest } from "@/server/http/origin-guard";

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

function forbidden(message = "Forbidden"): Response {
  return new Response(message, {
    status: 403,
    headers: headers({ "Content-Type": "text/plain; charset=utf-8" }),
  });
}

// The reading is written in the language the reader is browsing in. Resolved
// here, where request context exists, rather than defaulted deep in the
// workflow where a wrong guess would be invisible.
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

export async function POST(
  request: Request,
  context: { params: Promise<{ castingId: string }> },
): Promise<Response> {
  if (!isPaidDeepReadingCapabilityEnabled()) return notFound();
  if (!isStrictSameOriginRequest(request)) return forbidden("Cross-site requests prohibited");

  const session = await resolveSession(request.headers);
  if (!session?.user?.id) return unauthorized();

  const { castingId } = await context.params;

  try {
    const service = await createProductionDeepReadingService();
    const result = await service.requestDeepReading({
      userId: session.user.id,
      castingId,
      locale: requestLocale(request),
    });

    return json({
      status: result.status,
      jobId: result.jobId,
      reservationId: result.reservationId,
      ...(result.output ? { output: result.output } : {}),
    }, result.status === "completed" ? 200 : 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "CASTING_NOT_FOUND" || message === "USER_NOT_FOUND" || message === "USER_NOT_FOUND_OR_DELETED") {
      return notFound();
    }
    if (message === "CASTING_NOT_READY") {
      return json({ error: "CASTING_NOT_READY", message: "Casting must be revealed before requesting deep reading", retryable: false }, 422);
    }
    if (message === "RISK_PROHIBITED") {
      return json({ error: "RISK_PROHIBITED", message: "This reading is restricted by risk assessment", retryable: false }, 403);
    }
    if (message === "INSUFFICIENT_CREDITS") {
      return json({ error: "INSUFFICIENT_CREDITS", retryable: false }, 402);
    }
    if (message === "QUESTION_DECRYPT_FAILED" || message === "QUESTION_KEY_UNAVAILABLE") {
      return json({ error: message, retryable: false }, 422);
    }
    return json({ error: "DEEP_READING_FAILED", retryable: true }, 500);
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ castingId: string }> },
): Promise<Response> {
  if (!isPaidDeepReadingCapabilityEnabled()) return notFound();

  const session = await resolveSession(request.headers);
  if (!session?.user?.id) return unauthorized();

  const { castingId } = await context.params;

  try {
    const service = await createProductionDeepReadingService();
    const result = await service.getDeepReadingStatus({
      userId: session.user.id,
      castingId,
    });

    return json(result, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "CASTING_NOT_FOUND" || message === "USER_NOT_FOUND" || message === "USER_NOT_FOUND_OR_DELETED") {
      return notFound();
    }
    return json({ error: "DEEP_READING_STATUS_FAILED", retryable: true }, 500);
  }
}
