import { describe, expect, it, vi } from "vitest";
import { CheckoutService } from "./checkout-service";

describe("CheckoutService", () => {
  it("uses server products and saves the Waffo session", async () => {
    const createOrder = vi.fn().mockResolvedValue({ id: "ord_1", requestId: "req_1", amountUsd: 2.99 });
    const saveProviderCheckoutId = vi.fn();
    const createCheckout = vi.fn().mockResolvedValue({ sessionId: "SES_1", checkoutUrl: "https://checkout.waffo.ai/SES_1" });
    const service = new CheckoutService({ orderRepository: { createOrder, saveProviderCheckoutId }, waffoClient: { createCheckout }, providerProductIds: { one: "PROD_one", three: "PROD_three", five: "PROD_five" }, appUrl: "https://example.com", requestId: () => "req_1" });
    await expect(service.create({ user: { id: "usr_1", email: "buyer@example.com" }, productId: "one" })).resolves.toMatchObject({ checkoutId: "SES_1" });
    expect(createCheckout).toHaveBeenCalledWith({ productId: "PROD_one", buyerIdentity: "usr_1", buyerEmail: "buyer@example.com", successUrl: "https://example.com/checkout/success?orderId=ord_1", orderMerchantExternalId: "ord_1", metadata: { orderId: "ord_1", internalProductId: "one" } });
    expect(saveProviderCheckoutId).toHaveBeenCalledWith({ orderId: "ord_1", checkoutId: "SES_1" });
  });
  it("rejects missing provider products before creating an order", async () => {
    const createOrder = vi.fn();
    const service = new CheckoutService({ orderRepository: { createOrder, saveProviderCheckoutId: vi.fn() }, waffoClient: { createCheckout: vi.fn() }, providerProductIds: { one: "", three: "PROD_three", five: "PROD_five" }, appUrl: "https://example.com", requestId: () => "req_1" });
    await expect(service.create({ user: { id: "usr_1", email: "buyer@example.com" }, productId: "one" })).rejects.toThrow("WAFFO_PRODUCT_NOT_CONFIGURED");
  });
});
