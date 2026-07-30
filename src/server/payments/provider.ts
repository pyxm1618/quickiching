export type CheckoutInput = {
  orderId: string;
  productId: string;
  userId: string;
  customerEmail: string;
  successUrl: string;
};

export type CheckoutReference = {
  providerCheckoutId: string;
  checkoutUrl: string;
};

export type PaymentEventType = "checkout.completed" | "refund.created" | "dispute.created";

export type PaymentEvent = {
  providerEventId: string;
  type: PaymentEventType;
  orderId: string;
  providerCheckoutId: string;
  raw: unknown;
};

export interface PaymentProvider {
  createCheckout(input: CheckoutInput): Promise<CheckoutReference>;
  verifyAndParseWebhook(rawBody: string, signature: string): PaymentEvent;
}
