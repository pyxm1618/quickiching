import { z } from "zod";
import {
  CASTING_METHODS,
  INTERPRETATION_GOALS,
  QUESTION_MAX_CHARS,
  QUESTION_MIN_CHARS,
  SCENES,
  type LineValue,
} from "@/domain/casting/types";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { evaluateRisk } from "@/domain/risk/engine";
import { resolveSession } from "@/lib/auth/session";
import { isPaidDeepReadingCapabilityEnabled } from "@/server/generation/deep-reading-capability";
import { createProductionCastingRepository } from "@/server/casting/composition";
import { isStrictSameOriginRequest } from "@/server/http/origin-guard";
import { readRequestBody, RequestBodyTooLargeError } from "@/server/http/read-request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 8 * 1024;

/**
 * Only the raw draw and its framing are accepted. The hexagram numbers, the
 * moving lines and the relating hexagram are deliberately absent: they are
 * recomputed from the line values, so a caller cannot name the hexagram it
 * wants to be given.
 */
const bodySchema = z.object({
  lineValuesBottomUp: z.array(z.union([
    z.literal(6),
    z.literal(7),
    z.literal(8),
    z.literal(9),
  ])).length(6),
  method: z.enum(CASTING_METHODS as unknown as [string, ...string[]]),
  question: z.string().trim().min(QUESTION_MIN_CHARS).max(QUESTION_MAX_CHARS),
  scene: z.enum(SCENES as unknown as [string, ...string[]]),
  interpretationGoal: z.enum(INTERPRETATION_GOALS as unknown as [string, ...string[]]),
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

export async function POST(request: Request): Promise<Response> {
  if (!isPaidDeepReadingCapabilityEnabled()) return notFound();
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

  let session: Awaited<ReturnType<typeof resolveSession>>;
  try {
    session = await resolveSession(request.headers);
  } catch {
    return json({ error: "AUTH_UNAVAILABLE" }, 503);
  }
  if (!session?.user?.id) return json({ error: "AUTH_REQUIRED" }, 401);

  const input = parsed.data;

  // Recompute rather than trust. A mapping gap would mean our own table is
  // wrong, not that the caller misbehaved, so it is a 500 rather than a 400.
  let facts;
  try {
    facts = buildHexagramResult({
      lineValuesBottomUp: input.lineValuesBottomUp as LineValue[],
      method: input.method as (typeof CASTING_METHODS)[number],
    });
  } catch {
    return json({ error: "CAST_COMPUTATION_FAILED" }, 500);
  }

  const risk = evaluateRisk(input.question, input.scene as (typeof SCENES)[number]);

  let repository: Awaited<ReturnType<typeof createProductionCastingRepository>>;
  try {
    repository = await createProductionCastingRepository();
  } catch {
    return json({ error: "CLAIM_UNAVAILABLE" }, 503);
  }

  let persisted: Awaited<ReturnType<typeof repository.persistAttestedCast>>;
  try {
    persisted = await repository.persistAttestedCast({
      userId: session.user.id,
      method: input.method as (typeof CASTING_METHODS)[number],
      scene: input.scene as (typeof SCENES)[number],
      interpretationGoal: input.interpretationGoal as (typeof INTERPRETATION_GOALS)[number],
      question: input.question,
      facts,
      risk,
    });
  } catch {
    return json({ error: "CLAIM_UNAVAILABLE" }, 503);
  }

  // The cast is recorded either way — the block is a property of the question,
  // and hiding it from our own records would make the refusal unauditable.
  // Every downstream generation path requires risk_status to be exactly
  // "allowed", so anything else is reported here rather than failing later.
  if (risk.status !== "allowed") {
    return json({ error: "RISK_PROHIBITED", riskStatus: risk.status, reasonCode: risk.reasonCode }, 403);
  }

  return json({ castingId: persisted.castingId }, persisted.reused ? 200 : 201);
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
