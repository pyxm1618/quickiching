import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAuthCapabilityEnabled } from "@/server/auth/capability";
import { isAiPreviewCapabilityEnabled } from "@/server/generation/capability";
import { isPaidDeepReadingCapabilityEnabled } from "@/server/generation/deep-reading-capability";
import {
  isCheckoutCapabilityEnabled,
  isWebhookIngestionCapabilityEnabled,
} from "@/server/payments/capability";
import { isReconcileCapabilityEnabled } from "@/server/reconcile/capability";

const GONE_PREFIXES = ["/checkout"] as const;
const NOT_FOUND_PREFIXES = ["/result", "/cast"] as const;
const PERSONALIZED_API_PATH = "/api/personalized-interpretation";
const HEALTH_API_PATH = "/api/health";
const READY_API_PATH = "/api/ready";
const CHECKOUT_API_PATH = "/api/checkout";
const ACCOUNT_DELETE_API_PATH = "/api/account/delete";
const WAFFO_WEBHOOK_PATH = "/api/webhooks/waffo";
const RECONCILE_API_PATH = "/api/internal/reconcile";
const COMMERCIAL_PREVIEW_PATH = /^\/api\/readings\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\/preview\/?$/;
const COMMERCIAL_DEEP_READING_PATH = /^\/api\/readings\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\/deep\/?$/;
const COMMERCIAL_READING_STATUS_PATH = /^\/api\/readings\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\/?$/;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isCommercialPreviewPath(pathname: string): boolean {
  return COMMERCIAL_PREVIEW_PATH.test(pathname);
}

function isCommercialDeepReadingPath(pathname: string): boolean {
  return COMMERCIAL_DEEP_READING_PATH.test(pathname);
}

function isCommercialReadingStatusPath(pathname: string): boolean {
  return COMMERCIAL_READING_STATUS_PATH.test(pathname);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (request.headers.has("next-action")) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (matchesPrefix(pathname, "/signin")) {
    if (isAuthCapabilityEnabled()) return NextResponse.next();
    return new NextResponse("This Commercial V2 route is not available in Public V1.", {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (matchesPrefix(pathname, "/account")) {
    if (isAuthCapabilityEnabled()) return NextResponse.next();
    return new NextResponse("This Commercial V2 route is not available in Public V1.", {
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

  if (GONE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
    return new NextResponse("This Commercial V2 route is not available in Public V1.", {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (NOT_FOUND_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  if (isCommercialPreviewPath(pathname) || isCommercialReadingStatusPath(pathname)) {
    if (isAiPreviewCapabilityEnabled()) return NextResponse.next();
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

  if (pathname === HEALTH_API_PATH || pathname === `${HEALTH_API_PATH}/`) {
    return NextResponse.next();
  }

  if (pathname === READY_API_PATH || pathname === `${READY_API_PATH}/`) {
    return NextResponse.next();
  }

  if (pathname === CHECKOUT_API_PATH || pathname === `${CHECKOUT_API_PATH}/`) {
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

  if (matchesPrefix(pathname, "/api") && pathname !== PERSONALIZED_API_PATH && pathname !== `${PERSONALIZED_API_PATH}/`) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
