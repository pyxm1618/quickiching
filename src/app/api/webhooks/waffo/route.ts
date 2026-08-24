import { isWebhookIngestionCapabilityEnabled } from "@/server/payments/capability";
import { createProductionWaffoWebhookService } from "@/server/payments/composition";
import { WaffoWebhookError } from "@/server/payments/waffo-webhook";
import { WebhookServiceError } from "@/server/payments/webhook-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BYTES = 64 * 1024;

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

function failure(error: unknown): Response {
  if (error instanceof WaffoWebhookError) {
    const status = error.code === "WEBHOOK_SIGNATURE_INVALID" ? 401 : 400;
    return json({ error: error.code, retryable: error.retryable }, status);
  }
  if (error instanceof WebhookServiceError) {
    return json({ error: error.code, retryable: error.retryable }, error.retryable ? 503 : 400);
  }
  return json({ error: "WEBHOOK_UNAVAILABLE", retryable: true }, 503);
}

export async function POST(request: Request): Promise<Response> {
  if (!isWebhookIngestionCapabilityEnabled()) return notFound();
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "WEBHOOK_PAYLOAD_INVALID", retryable: false }, 400);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(declaredLength) || declaredLength < 0) {
    return json({ error: "WEBHOOK_PAYLOAD_INVALID", retryable: false }, 400);
  }
  if (declaredLength > MAX_WEBHOOK_BYTES) {
    return json({ error: "WEBHOOK_PAYLOAD_TOO_LARGE", retryable: false }, 413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return json({ error: "WEBHOOK_PAYLOAD_INVALID", retryable: false }, 400);
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BYTES) {
    return json({ error: "WEBHOOK_PAYLOAD_TOO_LARGE", retryable: false }, 413);
  }

  try {
    const service = await createProductionWaffoWebhookService();
    const result = await service.ingest(rawBody, request.headers.get("x-waffo-signature"));
    return json({ disposition: result.disposition, outcome: result.outcome }, result.disposition === "processed" ? 200 : 202);
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
