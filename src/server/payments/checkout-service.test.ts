import { describe, expect, it, vi } from "vitest";
import { CheckoutService } from "./checkout-service";

const user = { id: "usr_checkout", email: "buyer@example.com" };

describe("CheckoutService", () => {
  it("uses server product configuration and internal order request id", async () => {
    const createOrder = vi.fn().mockResolvedValue({
      id: "ord_checkout",
      requestId: "req_checkout",
      amountUsd: 2.99,
    });
    const createCheckout = vi.fn().mockResolvedValue({
      id: "ch_checkout",
      status: "pending",
      checkoutUrl: "https://checkout.creem.io/ch_checkout",
      requestId: "req_checkout",
    });
    const service = new CheckoutService({
      orderRepository: { createOrder },
      creemClient: { createCheckout },
      providerProductIds: { one: "prod_creem_one", three: "prod_creem_three", five: "prod_creem_five" },
      appUrl: "https://example.com",
      requestId: () => "req_checkout",
    });

    const result = await service.create({ user, productId: "one" });

    expect(createOrder).toHaveBeenCalledWith({
      userId: user.id,
      productId: "one",
      amountUsd: 2.99,
      currency: "USD",
      requestId: "req_checkout",
    });
    expect(createCheckout).toHaveBeenCalledWith({
      productId: "prod_creem_one",
      requestId: "req_checkout",
      successUrl: "https://example.com/checkout/success?orderId=ord_checkout",
      customerEmail: user.email,
      metadata: { orderId: "ord_checkout", userId: user.id, productId: "one" },
    });
    expect(result).toEqual({
      orderId: "ord_checkout",
      checkoutId: "ch_checkout",
      checkoutUrl: "https://checkout.creem.io/ch_checkout",
      amountUsd: 2.99,
    });
  });

  it("rejects an unconfigured provider product before creating an order", async () => {
    const createOrder = vi.fn();
    const service = new CheckoutService({
      orderRepository: { createOrder },
      creemClient: { createCheckout: vi.fn() },
      providerProductIds: { one: "", three: "prod_three", five: "prod_five" },
      appUrl: "https://example.com",
      requestId: () => "req_missing",
    });

    await expect(service.create({ user, productId: "one" })).rejects.toThrow("CREEM_PRODUCT_NOT_CONFIGURED");
    expect(createOrder).not.toHaveBeenCalled();
  });
});
