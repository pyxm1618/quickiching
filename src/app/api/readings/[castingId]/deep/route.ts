import { isPaidDeepReadingCapabilityEnabled } from "@/server/generation/deep-reading-capability";
import { createProductionDeepReadingService } from "@/server/generation/deep-reading-composition";
import { resolveSession } from "@/lib/auth/session";

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

export async function POST(
  request: Request,
  context: { params: Promise<{ castingId: string }> },
): Promise<Response> {
  if (!isPaidDeepReadingCapabilityEnabled()) return notFound();

  const session = await resolveSession(request.headers);
  if (!session?.user?.id) return unauthorized();

  const { castingId } = await context.params;

  try {
    const service = await createProductionDeepReadingService();
    const result = await service.requestDeepReading({
      userId: session.user.id,
      castingId,
    });

    return json({
      status: result.status,
      jobId: result.jobId,
      reservationId: result.reservationId,
      ...(result.output ? { output: result.output } : {}),
    }, result.status === "completed" ? 200 : 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "CASTING_NOT_FOUND" || message === "USER_NOT_FOUND_OR_DELETED") {
      return notFound();
    }
    if (message === "INSUFFICIENT_CREDITS") {
      return json({ error: "INSUFFICIENT_CREDITS", retryable: false }, 402);
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
    if (message === "CASTING_NOT_FOUND" || message === "USER_NOT_FOUND_OR_DELETED") {
      return notFound();
    }
    return json({ error: "DEEP_READING_STATUS_FAILED", retryable: true }, 500);
  }
}
