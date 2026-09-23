import { isAuthCapabilityEnabled } from "@/server/auth/capability";
import { resolveSession } from "@/lib/auth/session";
import { isStrictSameOriginRequest } from "@/server/http/origin-guard";
import { getCommercialDatabaseConnection } from "@/server/db/client";
import { createPostgresAccountRepository } from "@/server/account/postgres-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseHeaders(): Headers {
  return new Headers({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
}
function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: responseHeaders() });
}
function notFound(): Response { return new Response("Not Found", { status: 404, headers: responseHeaders() }); }

export async function POST(request: Request): Promise<Response> {
  if (!isAuthCapabilityEnabled()) return notFound();
  if (!isStrictSameOriginRequest(request)) return json({ error: "CSRF_REJECTED" }, 403);

  let session: Awaited<ReturnType<typeof resolveSession>>;
  try {
    session = await resolveSession(request.headers);
  } catch {
    return json({ error: "AUTH_UNAVAILABLE" }, 503);
  }
  if (!session?.user?.id) return json({ error: "AUTH_REQUIRED" }, 401);

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return json({ error: "ACCOUNT_DELETE_UNAVAILABLE" }, 503);
  try {
    const { client } = getCommercialDatabaseConnection(databaseUrl);
    await createPostgresAccountRepository({ sql: client }).deleteAccount(session.user.id);
    return json({ success: true }, 200);
  } catch {
    return json({ error: "ACCOUNT_DELETE_FAILED" }, 500);
  }
}

function methodNotAllowed(): Promise<Response> {
  return Promise.resolve(new Response("Method Not Allowed", {
    status: 405,
    headers: new Headers({ ...Object.fromEntries(responseHeaders()), Allow: "POST" }),
  }));
}
export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
