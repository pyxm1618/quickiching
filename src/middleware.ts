import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const destination = request.nextUrl.clone();
  destination.pathname = "/";
  destination.search = "";
  destination.searchParams.set("status", "temporarily-unavailable");
  return NextResponse.redirect(destination, 307);
}

export const config = {
  matcher: [
    "/signin/:path*",
    "/account/:path*",
    "/cast/:path*",
    "/result/:path*",
    "/checkout/:path*",
    "/api/auth/:path*",
    "/api/webhooks/:path*",
    "/api/internal/:path*",
    "/api/orders/:path*"
  ],
};
