import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (new URL(request.url).searchParams.get("view") === "account") {
    try {
      const user = await getCurrentUser();
      if (!user) return Response.json({ error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
      const { loadAccountModal } = await import("@/server/account/modal-loader");
      return Response.json(await loadAccountModal(user), { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
    } catch {
      return Response.json({ error: "ACCOUNT_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
    }
  }
  try {
    const user = await getCurrentUser({ allowUnavailable: true });
    return Response.json(
      { user: user ? { id: user.id, email: user.email } : null },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  } catch {
    return Response.json(
      { user: null },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  }
}
