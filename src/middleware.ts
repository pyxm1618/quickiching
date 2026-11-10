import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAuthCapabilityEnabled } from "@/server/auth/capability";
import { isPaidDeepReadingCapabilityEnabled } from "@/server/generation/deep-reading-capability";
import {
  isCheckoutCapabilityEnabled,
  isWebhookIngestionCapabilityEnabled,
} from "@/server/payments/capability";
import { isReconcileCapabilityEnabled } from "@/server/reconcile/capability";
import { normalizeLocalizedPathname } from "@/lib/seo";

const GONE_PREFIXES = ["/checkout"] as const;
const NOT_FOUND_PREFIXES = ["/result", "/cast"] as const;
const HEALTH_API_PATH = "/api/health";
const READY_API_PATH = "/api/ready";
const USER_ME_API_PATH = "/api/user/me";
const CHECKOUT_API_PATH = "/api/checkout";
const REFUNDS_API_PATH = "/api/refunds";
const INTERNAL_REFUNDS_API_PREFIX = "/api/internal/refunds";
const ACCOUNT_DELETE_API_PATH = "/api/account/delete";
const WAFFO_WEBHOOK_PATH = "/api/webhooks/waffo";
const RECONCILE_API_PATH = "/api/internal/reconcile";
const CP6_STAGING_DIAGNOSTICS_PATH = "/api/internal/cp6-staging-diagnostics";
const STAGING_VERCEL_PROJECT_ID = "prj_iKtw9xKmIlEfe44gEocgLr2QDLfE";
const STAGING_PRODUCTION_HOST = "staging.quickiching.com";
const COMMERCIAL_DEEP_READING_PATH = /^\/api\/readings\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\/deep\/?$/;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isCommercialDeepReadingPath(pathname: string): boolean {
  return COMMERCIAL_DEEP_READING_PATH.test(pathname);
}

function cp6StagingDiagnosticsEnabled(): boolean {
  return (
    process.env.VERCEL_ENV === "production" &&
    process.env.VERCEL_PROJECT_ID?.trim() === STAGING_VERCEL_PROJECT_ID &&
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim().toLowerCase() === STAGING_PRODUCTION_HOST &&
    process.env.QUICKICHING_DEPLOYMENT_TIER === "staging" &&
    Boolean(process.env.CP6_STAGING_MAINTENANCE_TOKEN?.trim())
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const capabilityPathname = normalizeLocalizedPathname(pathname);
  const unavailableMessage = pathname === "/zh" || pathname.startsWith("/zh/")
    ? "此功能暂不可用。"
    : "This feature is unavailable.";

  if (request.headers.has("next-action")) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (matchesPrefix(capabilityPathname, "/signin") || matchesPrefix(capabilityPathname, "/signup")) {
    if (isAuthCapabilityEnabled()) return NextResponse.next();
    return new NextResponse(unavailableMessage, {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (matchesPrefix(capabilityPathname, "/account")) {
    if (isAuthCapabilityEnabled()) return NextResponse.next();
    return new NextResponse(unavailableMessage, {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (matchesPrefix(pathname, "/api/auth")) {
    if (isAuthCapabilityEnabled()) return NextResponse.next();
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (pathname === ACCOUNT_DELETE_API_PATH || pathname === `${ACCOUNT_DELETE_API_PATH}/`) {
    if (isAuthCapabilityEnabled()) return NextResponse.next();
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (GONE_PREFIXES.some((prefix) => matchesPrefix(capabilityPathname, prefix))) {
    return new NextResponse(unavailableMessage, {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (NOT_FOUND_PREFIXES.some((prefix) => matchesPrefix(capabilityPathname, prefix))) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (isCommercialDeepReadingPath(pathname)) {
    if (isPaidDeepReadingCapabilityEnabled()) return NextResponse.next();
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (pathname === "/api/readings" || pathname === "/api/readings/") {
    if (isAuthCapabilityEnabled()) return NextResponse.next();
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (pathname === HEALTH_API_PATH || pathname === `${HEALTH_API_PATH}/`) {
    return NextResponse.next();
  }

  if (pathname === READY_API_PATH || pathname === `${READY_API_PATH}/`) {
    return NextResponse.next();
  }

  if (pathname === USER_ME_API_PATH || pathname === `${USER_ME_API_PATH}/`) {
    return NextResponse.next();
  }

  if (
    pathname === CP6_STAGING_DIAGNOSTICS_PATH ||
    pathname === `${CP6_STAGING_DIAGNOSTICS_PATH}/`
  ) {
    if (cp6StagingDiagnosticsEnabled()) return NextResponse.next();
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (pathname === CHECKOUT_API_PATH || pathname === `${CHECKOUT_API_PATH}/`) {
    if (isCheckoutCapabilityEnabled()) return NextResponse.next();
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (pathname === REFUNDS_API_PATH || pathname === `${REFUNDS_API_PATH}/`) {
    if (isCheckoutCapabilityEnabled()) return NextResponse.next();
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (matchesPrefix(pathname, INTERNAL_REFUNDS_API_PREFIX)) {
    if (isCheckoutCapabilityEnabled()) return NextResponse.next();
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (pathname === WAFFO_WEBHOOK_PATH || pathname === `${WAFFO_WEBHOOK_PATH}/`) {
    if (isWebhookIngestionCapabilityEnabled()) return NextResponse.next();
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (pathname === RECONCILE_API_PATH || pathname === `${RECONCILE_API_PATH}/`) {
    if (isReconcileCapabilityEnabled()) return NextResponse.next();
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (matchesPrefix(pathname, "/api")) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-quickiching-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Positive allowlist. Middleware is a Vercel Fluid Active CPU cost on every
// invocation, so requests that do not need a capability decision must never
// start it. The previous "/:path*" catch-all invoked middleware for every
// public page, static asset and Workflow internal route.
export const config = {
  matcher: [
    // Closed API boundary: auth, checkout, refunds, Waffo webhook, reconcile,
    // deep reading, internal APIs and unknown /api/* paths.
    "/api/:path*",

    // Page-level capability gates and retired-route responses, including their
    // existing subpath semantics.
    "/signin/:path*",
    "/signup/:path*",
    "/account/:path*",
    "/checkout/:path*",
    "/result/:path*",
    "/cast/:path*",

    // Chinese surface: localized capability gating, Chinese unavailable copy
    // and the x-quickiching-pathname header used by global 404 locale detection.
    "/zh",
    "/zh/:path*",

    // The Next-Action safety boundary is pathname-independent. A `has` matcher
    // keeps it global at the routing layer without re-introducing a catch-all
    // for ordinary traffic (Workflow routes and assets do not send this header).
    //
    // Contract (verified against the installed Next.js 15.5.25 runtime):
    // only a NON-EMPTY `next-action` value can be a Server Action request.
    // `getServerActionRequestMetadata` treats the header as a possible-action
    // prefilter, but `handleAction`'s `getActionModIdOrError` rejects a falsy
    // actionId with InvariantError("Missing 'next-action' header.") before any
    // worker forwarding, module lookup, reply decode or `executeAction`, and
    // answers with 404 + `x-nextjs-action-not-found: 1`. Valid IDs are 42-char
    // server reference IDs (`SERVER_REFERENCE_ID_LENGTH`), so an empty value is
    // not resolvable. A `has` matcher without `value` requires a truthy header
    // value (matchHas: `if (!hasItem.value && value)`), hence `Next-Action: ""`
    // no longer starts Middleware; Next.js's own 404 is the authoritative
    // boundary. Restoring the old `headers.has()` literal semantics for this
    // case would require the "/:path*" catch-all -- do not reintroduce it.
    // Re-validate this comment on any Next.js upgrade; see
    // src/middleware.matcher.test.ts "empty Next-Action" suite.
    {
      source: "/:path*",
      has: [{ type: "header", key: "next-action" }],
    },
  ],
};
