import type { Sql } from "postgres";
import type { ProductId } from "@/domain/entitlements/pricing";
import { getCommercialDatabaseConnection } from "@/server/db/client";
import { isCheckoutCapabilityEnabled } from "./capability";

type RuntimeEnv = Record<string, string | undefined>;

export type OrderStatusView = {
  status: "pending" | "checkout_initializing" | "checkout_created" | "paid" | "refunded" | "financial_review";
  productKey: ProductId;
  quantity: number;
};

export interface OrderStatusReader {
  /**
   * Reads one order the given user owns. Ownership is part of the query rather
   * than a check afterwards, so a mismatched owner is indistinguishable from a
   * missing order and neither confirms the other reader's order exists.
   */
  readOrderForUser(userId: string, orderId: string): Promise<OrderStatusView | null>;
}

export function createOrderStatusReader(dependencies: { sql: Sql }): OrderStatusReader {
  const { sql } = dependencies;
  return {
    async readOrderForUser(userId, orderId) {
      const rows = await sql`
        select status, product_key, quantity
        from payment_orders
        where id = ${orderId} and user_id = ${userId}
        limit 1
      ` as Record<string, unknown>[];
      const row = rows[0];
      if (!row) return null;
      return {
        status: String(row.status) as OrderStatusView["status"],
        productKey: String(row.product_key) as ProductId,
        quantity: Number(row.quantity),
      };
    },
  };
}

export async function createProductionOrderStatusReader(
  env: RuntimeEnv = process.env,
): Promise<OrderStatusReader> {
  if (!isCheckoutCapabilityEnabled(env)) throw new Error("CHECKOUT_DISABLED");
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("COMMERCIAL_DATABASE_UNAVAILABLE");
  const { client } = getCommercialDatabaseConnection(databaseUrl);
  return createOrderStatusReader({ sql: client });
}
