import { getCurrentUser } from "@/lib/auth/session";

export type AccountPurchase = {
  id: string;
  productKey: "one" | "three" | "five";
  quantity: number;
  amountMinor: number;
  currency: "USD";
  status: string;
  paidAt: Date | null;
  createdAt: Date;
  refund: {
    id: string;
    status: string;
    autoScreen: string;
    screenReason: string | null;
  } | null;
};

export async function loadAccountPurchases(): Promise<AccountPurchase[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  if (process.env.DATABASE_ADAPTER_MODE !== "postgres" || !process.env.DATABASE_URL) return [];

  const { getPostgresClient } = await import("@/server/db/client");
  const sql = getPostgresClient();
  const rows = await sql<Array<Record<string, unknown>>>`
    select
      o.id, o.product_key, o.quantity, o.amount_minor, o.currency, o.status,
      o.paid_at, o.created_at,
      r.id as refund_id, r.status as refund_status, r.auto_screen,
      r.screen_reason
    from payment_orders o
    left join refund_intents r on r.order_id = o.id
    where o.user_id = ${user.id}
    order by o.created_at desc
    limit 25
  `;

  return rows.map((row) => {
    const productKey = String(row.product_key);
    const currency = String(row.currency);
    if (productKey !== "one" && productKey !== "three" && productKey !== "five") {
      throw new Error("ACCOUNT_PURCHASE_PRODUCT_INVALID");
    }
    if (currency !== "USD") throw new Error("ACCOUNT_PURCHASE_CURRENCY_INVALID");
    return {
      id: String(row.id),
      productKey,
      quantity: Number(row.quantity),
      amountMinor: Number(row.amount_minor),
      currency,
      status: String(row.status),
      paidAt: row.paid_at == null ? null : new Date(String(row.paid_at)),
      createdAt: new Date(String(row.created_at)),
      refund: row.refund_id == null
        ? null
        : {
            id: String(row.refund_id),
            status: String(row.refund_status),
            autoScreen: String(row.auto_screen),
            screenReason: row.screen_reason == null ? null : String(row.screen_reason),
          },
    };
  });
}
