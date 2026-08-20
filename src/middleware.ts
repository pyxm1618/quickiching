import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const GONE_PREFIXES = ["/signin", "/account", "/checkout"] as const;
const NOT_FOUND_PREFIXES = ["/result", "/cast"] as const;
const PERSONALIZED_API_PATH = "/api/personalized-interpretation";

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (request.headers.has("next-action")) {
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
