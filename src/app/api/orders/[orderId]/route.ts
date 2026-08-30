import { resolveSession } from "@/lib/auth/session";
import { isCheckoutCapabilityEnabled } from "@/server/payments/capability";
import { createProductionOrderStatusReader } from "@/server/payments/order-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

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

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  if (!isCheckoutCapabilityEnabled()) return notFound();

  let session: Awaited<ReturnType<typeof resolveSession>>;
  try {
    session = await resolveSession(_request.headers);
  } catch {
    return json({ error: "AUTH_UNAVAILABLE" }, 503);
  }
  if (!session?.user?.id) return json({ error: "AUTH_REQUIRED" }, 401);

  const { orderId } = await context.params;
  // A malformed id is answered the same way a stranger's id is: not found.
  if (!UUID.test(orderId)) return json({ error: "ORDER_NOT_FOUND" }, 404);

  let reader: Awaited<ReturnType<typeof createProductionOrderStatusReader>>;
  try {
    reader = await createProductionOrderStatusReader();
  } catch {
    return json({ error: "ORDER_STATUS_UNAVAILABLE" }, 503);
  }

  let order: Awaited<ReturnType<typeof reader.readOrderForUser>>;
  try {
    order = await reader.readOrderForUser(session.user.id, orderId);
  } catch {
    return json({ error: "ORDER_STATUS_UNAVAILABLE" }, 503);
  }
  if (!order) return json({ error: "ORDER_NOT_FOUND" }, 404);

  return json({ status: order.status, productKey: order.productKey, quantity: order.quantity });
}

function methodNotAllowed(): Promise<Response> {
  return Promise.resolve(new Response("Method Not Allowed", {
    status: 405,
    headers: headers({ "Allow": "GET", "Content-Type": "text/plain; charset=utf-8" }),
  }));
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
