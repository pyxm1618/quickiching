import { loadPublicHexagramKnowledge } from "@/domain/public-reading/knowledge";
import {
  personalizedInterpretationRequestSchema,
  PERSONALIZED_REQUEST_SCHEMA_VERSION,
} from "@/domain/public-reading/personalized";
import { normalizePublicQuestion } from "@/domain/public-reading/question";
import { buildPublicReading, readingFingerprint } from "@/domain/public-reading/reading";
import { PUBLIC_METHOD_VERSIONS } from "@/domain/public-reading/types";
import { evaluateRisk } from "@/domain/risk/engine";
import { isPersonalizedGatewayConfigured, requestPersonalizedInterpretation } from "@/server/ai/personalized-gateway";
import {
  checkPersonalizedRateLimit,
  isPersonalizedRateLimitConfigured,
  personalizedRequestAddress,
} from "@/server/security/personalized-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 64 * 1024;
const TURNSTILE_TIMEOUT_MS = 3_000;
const TURNSTILE_ACTION = "personalized-interpretation";

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function unavailable(code = "PERSONALIZED_INTERPRETATION_UNAVAILABLE"): Response {
  return jsonResponse({ error: code, fallback: "static" }, 503);
}

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function turnstileAllowedHostnames(): string[] {
  return (process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
}

async function verifyTurnstile(token: string | undefined, request: Request): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  if (!secret || !siteKey) return false;
  if (!token) return false;

  const controller = new AbortController();
  const cancelFromCaller = () => controller.abort(request.signal.reason);
  if (request.signal.aborted) cancelFromCaller();
  else request.signal.addEventListener("abort", cancelFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);
  try {
    const form = new URLSearchParams({ secret, response: token });
    const remoteIp = personalizedRequestAddress(request);
    if (remoteIp !== "unknown") form.set("remoteip", remoteIp);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return false;
    const verification = payload as { success?: unknown; action?: unknown; hostname?: unknown };
    if (verification.success !== true || verification.action !== TURNSTILE_ACTION || typeof verification.hostname !== "string") return false;
    const allowedHostnames = turnstileAllowedHostnames();
    return allowedHostnames.length === 0
      ? process.env.NODE_ENV !== "production"
      : allowedHostnames.includes(verification.hostname.toLowerCase());
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", cancelFromCaller);
  }
}

function personalizedActivationReady(): boolean {
  return process.env.PERSONALIZED_INTERPRETATION_ENABLED === "true"
    && isPersonalizedGatewayConfigured(process.env)
    && Boolean(process.env.TURNSTILE_SECRET_KEY?.trim())
    && Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim())
    && turnstileAllowedHostnames().length > 0
    && isPersonalizedRateLimitConfigured(process.env);
}

export async function GET(): Promise<Response> {
  return Response.json({ error: "METHOD_NOT_ALLOWED" }, {
    status: 405,
    headers: {
      Allow: "POST",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ error: "REQUEST_TOO_LARGE", fallback: "static" }, 413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ error: "REQUEST_TOO_LARGE", fallback: "static" }, 413);
    }
  } catch {
    return jsonResponse({ error: "INVALID_REQUEST", fallback: "static" }, 400);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return jsonResponse({ error: "INVALID_REQUEST", fallback: "static" }, 400);
  }

  const parsed = personalizedInterpretationRequestSchema.safeParse(body);
  if (!parsed.success || parsed.data.schemaVersion !== PERSONALIZED_REQUEST_SCHEMA_VERSION) {
    return jsonResponse({ error: "INVALID_REQUEST", fallback: "static" }, 400);
  }
  const input = parsed.data;

  let question: string;
  try {
    question = normalizePublicQuestion(input.question) ?? "";
  } catch {
    return jsonResponse({ error: "INVALID_QUESTION", fallback: "static" }, 400);
  }
  if (!question) return jsonResponse({ error: "INVALID_QUESTION", fallback: "static" }, 400);
  if (input.methodVersion !== PUBLIC_METHOD_VERSIONS[input.method]) {
    return jsonResponse({ error: "READING_VERSION_MISMATCH", fallback: "static" }, 400);
  }

  let verifiedReading;
  try {
    verifiedReading = buildPublicReading({
      method: input.method,
      methodVersion: input.methodVersion,
      question,
      lineValuesBottomUp: input.lineValuesBottomUp,
      evidence: { kind: "history", originalMethod: input.method },
    });
  } catch {
    return jsonResponse({ error: "READING_FACTS_INVALID", fallback: "static" }, 400);
  }

  if (readingFingerprint(verifiedReading) !== input.readingFingerprint
    || verifiedReading.primaryHexagram !== input.primaryHexagram
    || !sameNumbers(verifiedReading.changingLines, input.changingLines)
    || verifiedReading.relatingHexagram !== input.relatingHexagram) {
    return jsonResponse({ error: "READING_FACTS_MISMATCH", fallback: "static" }, 400);
  }

  const risk = evaluateRisk(question, "other");
  if (risk.status !== "allowed") {
    return jsonResponse({ error: "QUESTION_NOT_ELIGIBLE", fallback: "static" }, 422);
  }

  if (!personalizedActivationReady()) {
    return unavailable();
  }

  if (!(await verifyTurnstile(input.turnstileToken, request))) {
    return jsonResponse({ error: "BOT_CHECK_UNAVAILABLE", fallback: "static" }, 403);
  }

  if (!(await checkPersonalizedRateLimit(request, { signal: request.signal }))) {
    return jsonResponse({ error: "RATE_LIMITED", fallback: "static" }, 429);
  }

  if (!isPersonalizedGatewayConfigured(process.env)) return unavailable();

  try {
    const [primary, relating] = await Promise.all([
      loadPublicHexagramKnowledge(verifiedReading.primaryHexagram),
      verifiedReading.relatingHexagram === null
        ? Promise.resolve(null)
        : loadPublicHexagramKnowledge(verifiedReading.relatingHexagram),
    ]);
    const result = await requestPersonalizedInterpretation({
      request: { ...input, question },
      primary,
      relating,
      signal: request.signal,
    });
    return jsonResponse(result, 200);
  } catch {
    return unavailable();
  }
}
