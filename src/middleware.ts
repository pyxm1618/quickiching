import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAuthCapabilityEnabled } from "@/server/auth/capability";
import { isAiPreviewCapabilityEnabled } from "@/server/generation/capability";

const GONE_PREFIXES = ["/account", "/checkout"] as const;
const NOT_FOUND_PREFIXES = ["/result", "/cast"] as const;
const PERSONALIZED_API_PATH = "/api/personalized-interpretation";
const COMMERCIAL_PREVIEW_PATH = /^\/api\/readings\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\/preview\/?$/;
const COMMERCIAL_READING_STATUS_PATH = /^\/api\/readings\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\/?$/;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isCommercialPreviewPath(pathname: string): boolean {
  return COMMERCIAL_PREVIEW_PATH.test(pathname);
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

  if (matchesPrefix(pathname, "/api/auth")) {
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
