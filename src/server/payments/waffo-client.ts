import { WaffoPancake, WaffoPancakeError } from "@waffo/pancake-ts";

export type WaffoCheckoutInput = {
  productId: string;
  buyerIdentity: string;
  buyerEmail: string;
  successUrl: string;
  orderMerchantExternalId: string;
  metadata: Record<string, string>;
};

function httpsUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("WAFFO_CHECKOUT_URL_INVALID");
  return url.toString();
}

/** Server-only SDK boundary. The SDK owns merchant request signing. */
export class WaffoClient {
  private readonly client: WaffoPancake;

  constructor(credentials: { merchantId: string; privateKey: string }) {
    this.client = new WaffoPancake({
      merchantId: credentials.merchantId,
      privateKey: credentials.privateKey,
    });
  }

  async createCheckout(input: WaffoCheckoutInput): Promise<{ sessionId: string; checkoutUrl: string }> {
    try {
      const session = await this.client.checkout.authenticated.create({
        productId: input.productId,
        currency: "USD",
        buyerIdentity: input.buyerIdentity,
        buyerEmail: input.buyerEmail,
        successUrl: input.successUrl,
        orderMerchantExternalId: input.orderMerchantExternalId,
        metadata: input.metadata,
      });
      return { sessionId: session.sessionId, checkoutUrl: httpsUrl(session.checkoutUrl) };
    } catch (error) {
      if (error instanceof WaffoPancakeError) {
        const cause = error.errors[0]?.message ?? "provider_error";
        if (error.status >= 500) throw new Error(`WAFFO_PROVIDER_RETRYABLE:${cause}`);
        throw new Error("WAFFO_CHECKOUT_REJECTED");
      }
      throw error;
    }
  }
}
