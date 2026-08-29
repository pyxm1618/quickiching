import { timingSafeEqual } from "node:crypto";
import { collectStagingRuntimeDiagnostics } from "@/server/readiness/staging-runtime-diagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGING_ORIGIN = "https://staging.quickiching.com";
const STAGING_VERCEL_PROJECT_ID = "prj_iKtw9xKmIlEfe44gEocgLr2QDLfE";
const STAGING_PRODUCTION_HOST = "staging.quickiching.com";

function responseHeaders(extra: Record<string, string> = {}): Headers {
  return new Headers({
    "Cache-Control": "no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
    ...extra,
  });
}

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: responseHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
  });
}

function unauthorized(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: responseHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
  });
}

function sameOrigin(candidate: string | undefined, expected: string): boolean {
  if (!candidate?.trim()) return false;
  try {
    return new URL(candidate).origin === expected;
  } catch {
    return false;
  }
}

function stagingProjectIdentityMatches(env: Record<string, string | undefined>): boolean {
  return (
    env.VERCEL_PROJECT_ID?.trim() === STAGING_VERCEL_PROJECT_ID &&
    env.VERCEL_PROJECT_PRODUCTION_URL?.trim().toLowerCase() === STAGING_PRODUCTION_HOST
  );
}

function isCp6StagingMaintenanceRuntime(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env.VERCEL_ENV === "production" &&
    stagingProjectIdentityMatches(env) &&
    env.QUICKICHING_DEPLOYMENT_TIER === "staging" &&
    sameOrigin(env.APP_BASE_URL, STAGING_ORIGIN) &&
    Boolean(env.CP6_STAGING_MAINTENANCE_TOKEN?.trim())
  );
}

function verifyBearer(request: Request, expectedSecret: string): boolean {
  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader?.startsWith("Bearer ")) return false;
  const provided = authHeader.slice(7).trim();
  if (!provided || !expectedSecret) return false;

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expectedSecret);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function GET(request: Request): Promise<Response> {
  if (!isCp6StagingMaintenanceRuntime()) return notFound();

  const maintenanceToken = process.env.CP6_STAGING_MAINTENANCE_TOKEN?.trim() ?? "";
  if (!verifyBearer(request, maintenanceToken)) return unauthorized();

  try {
    const diagnostics = await collectStagingRuntimeDiagnostics(process.env);
    return Response.json(
      {
        deployment: {
          environment: process.env.VERCEL_ENV?.trim() || null,
          projectIdMatchesStaging:
            process.env.VERCEL_PROJECT_ID?.trim() === STAGING_VERCEL_PROJECT_ID,
          productionUrlMatchesStaging:
            process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim().toLowerCase() ===
            STAGING_PRODUCTION_HOST,
          tierConfigured:
            process.env.QUICKICHING_DEPLOYMENT_TIER?.trim() === "staging",
          appBaseUrlMatchesStaging: sameOrigin(process.env.APP_BASE_URL, STAGING_ORIGIN),
          gitSha: process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null,
          gitRef: process.env.VERCEL_GIT_COMMIT_REF?.trim() || null,
        },
        ...diagnostics,
      },
      { status: 200, headers: responseHeaders() },
    );
  } catch {
    return Response.json(
      { error: "CP6_STAGING_DIAGNOSTICS_FAILED" },
      { status: 500, headers: responseHeaders() },
    );
  }
}

function methodNotAllowed(): Promise<Response> {
  return Promise.resolve(new Response("Method Not Allowed", {
    status: 405,
    headers: responseHeaders({
      "Allow": "GET",
      "Content-Type": "text/plain; charset=utf-8",
    }),
  }));
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
