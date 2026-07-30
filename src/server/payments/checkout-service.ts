import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { CURRENCY, PRODUCTS } from "@/domain/entitlements/pricing";
import type { PaymentProvider } from "./provider";

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export class CheckoutService {
  constructor(private readonly dependencies: {
    sql: Sql;
    provider: PaymentProvider;
    productIds: Record<keyof typeof PRODUCTS, string>;
    appUrl: string;
  }) {}

  async create(input: {
    userId: string;
    email: string;
    productId: keyof typeof PRODUCTS;
  }): Promise<{ orderId: string; checkoutUrl: string; amountUsd: number }> {
    const product = PRODUCTS[input.productId];
    const providerProductId = this.dependencies.productIds[input.productId];
    if (!providerProductId) throw new Error("CREEM_PRODUCT_NOT_CONFIGURED");
    const orderId = id("ord");
    const now = new Date();
    await this.dependencies.sql`
      insert into orders (
        id, user_id, product_id, amount_usd, currency, request_id,
        status, created_at, updated_at
      ) values (
        ${orderId}, ${input.userId}, ${input.productId}, ${product.unitPriceUsd},
        ${CURRENCY}, ${orderId}, 'pending', ${now}, ${now}
      )
    `;
    const checkout = await this.dependencies.provider.createCheckout({
      orderId,
      productId: providerProductId,
      userId: input.userId,
      customerEmail: input.email,
      successUrl: `${this.dependencies.appUrl}/account?checkout=success`,
    });
    await this.dependencies.sql`
      update orders set provider_checkout_id = ${checkout.providerCheckoutId}, updated_at = now()
      where id = ${orderId} and status = 'pending'
    `;
    return { orderId, checkoutUrl: checkout.checkoutUrl, amountUsd: product.unitPriceUsd };
  }
}
