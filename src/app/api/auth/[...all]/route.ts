import { isAuthCapabilityEnabled } from "@/server/auth/capability";
import { normalizeAuthRequestBody } from "@/server/auth/request";

type AuthMethod = "GET" | "POST";

function unavailable(status = 404): Response {
  return new Response(status === 404 ? "Not Found" : "Authentication unavailable", {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function methodNotAllowed(): Response {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Allow": "GET, POST",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

async function dispatch(method: AuthMethod, request: Request): Promise<Response> {
  if (!isAuthCapabilityEnabled()) return unavailable();
  try {
    const { getAuthHandler } = await import("@/server/auth/server");
    let normalizedRequest = request;
    if (method === "POST" && request.headers.get("content-type")?.includes("application/json")) {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        throw new Error("AUTH_REQUEST_INVALID");
      }
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        throw new Error("AUTH_REQUEST_INVALID");
      }
      const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
      normalizedRequest = new Request(request, {
        body: JSON.stringify(normalizeAuthRequestBody(body as Record<string, unknown>, baseURL)),
      });
    }
    return getAuthHandler()[method](normalizedRequest);
  } catch (error) {
    if (error instanceof Error && [
      "AUTH_EMAIL_INVALID",
      "AUTH_CALLBACK_INVALID",
      "AUTH_REQUEST_INVALID",
    ].includes(error.message)) {
      return unavailable(400);
    }
    // Configuration and adapter failures never become a dev/memory fallback.
    return unavailable(503);
  }
}

export function GET(request: Request) {
  return dispatch("GET", request);
}

export function POST(request: Request) {
  return dispatch("POST", request);
}

async function rejectUnsupportedMethod(): Promise<Response> {
  return isAuthCapabilityEnabled() ? methodNotAllowed() : unavailable();
}

export function PATCH(_request: Request) {
  return rejectUnsupportedMethod();
}

export function PUT(_request: Request) {
  return rejectUnsupportedMethod();
}

export function DELETE(_request: Request) {
  return rejectUnsupportedMethod();
}
