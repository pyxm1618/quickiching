import { getCurrentUser } from "@/lib/auth/session";
import { getProductionRuntime } from "@/server/runtime/production";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDER_ID_PATTERN = /^ord_[A-Za-z0-9_-]{8,128}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });
  const { orderId } = await params;
  if (!ORDER_ID_PATTERN.test(orderId)) {
    return Response.json({ error: "order_not_found" }, { status: 404 });
  }

  const runtime = await getProductionRuntime();
  const rows = await runtime.sql`
    select id, product_id, amount_usd, currency, status,
      financial_review_required, updated_at
    from orders
    where id = ${orderId} and user_id = ${user.id}
    limit 1
  `;
  const order = rows[0];
  if (!order) return Response.json({ error: "order_not_found" }, { status: 404 });

  return Response.json({
    orderId: order.id,
    productId: order.product_id,
    amountUsd: Number(order.amount_usd),
    currency: order.currency,
    status: order.status,
    financialReviewRequired: Boolean(order.financial_review_required),
    updatedAt: order.updated_at,
  }, {
    headers: { "cache-control": "no-store" },
  });
}
