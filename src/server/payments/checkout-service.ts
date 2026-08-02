import { CURRENCY, getProduct, type ProductId } from "@/domain/entitlements/pricing";
import { DomainError } from "@/server/errors/domain-error";

type UserIdentity = { id: string; email: string };

type OrderRecord = { id: string; requestId: string; amountUsd: number };

export class CheckoutService {
  constructor(private readonly dependencies: {
    orderRepository: {
      createOrder(input: {
        userId: string;
        productId: ProductId;
        amountUsd: number;
        currency: string;
        requestId: string;
      }): OrderRecord | Promise<OrderRecord>;
      saveProviderCheckoutId(input: { orderId: string; checkoutId: string }): void | Promise<void>;
    };
    waffoClient: {
      createCheckout(input: {
        productId: string;
        buyerIdentity: string;
        successUrl: string;
        buyerEmail: string;
        orderMerchantExternalId: string;
        metadata: Record<string, string>;
      }): Promise<{ sessionId: string; checkoutUrl: string }>;
    };
    providerProductIds: Record<ProductId, string>;
    appUrl: string;
    requestId(): string;
  }) {}

  async create(input: { user: UserIdentity; productId: string }): Promise<{
    orderId: string;
    checkoutId: string;
    checkoutUrl: string;
    amountUsd: number;
  }> {
    const product = getProduct(input.productId);
    if (!product) throw new DomainError("INVALID_PRODUCT", "Unknown product.", false);
    const providerProductId = this.dependencies.providerProductIds[product.id]?.trim();
    if (!providerProductId) {
      throw new DomainError("WAFFO_PRODUCT_NOT_CONFIGURED", "This product is not available.", false);
    }
    const appUrl = new URL(this.dependencies.appUrl);
    if (appUrl.protocol !== "https:") throw new Error("APP_URL_INVALID");
    const requestId = this.dependencies.requestId();
    const order = await this.dependencies.orderRepository.createOrder({
      userId: input.user.id,
      productId: product.id,
      amountUsd: product.unitPriceUsd,
      currency: CURRENCY,
      requestId,
    });
    const successUrl = new URL("/checkout/success", appUrl);
    successUrl.searchParams.set("orderId", order.id);
    const checkout = await this.dependencies.waffoClient.createCheckout({
      productId: providerProductId,
      buyerIdentity: input.user.id,
      successUrl: successUrl.toString(),
      buyerEmail: input.user.email,
      orderMerchantExternalId: order.id,
      metadata: {
        orderId: order.id,
        internalProductId: product.id,
      },
    });
    if (!checkout.sessionId) throw new Error("WAFFO_SESSION_ID_MISSING");
    await this.dependencies.orderRepository.saveProviderCheckoutId({
      orderId: order.id,
      checkoutId: checkout.sessionId,
    });
    return {
      orderId: order.id,
      checkoutId: checkout.sessionId,
      checkoutUrl: checkout.checkoutUrl,
      amountUsd: product.unitPriceUsd,
    };
  }
}
