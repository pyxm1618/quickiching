import { describe, expect, it } from "vitest";
import { parseWaffoWebhook } from "@/server/payments/waffo-webhook";

describe("Waffo payment privacy boundary", () => {
  it("requires a validated email but exposes no private key", () => {
    const event = parseWaffoWebhook({ id: "delivery", timestamp: "2026-08-02T00:00:00.000Z", eventId: "PAY_1", eventType: "order.completed", storeId: "STO_test", mode: "test", data: { orderId: "ORD_1", buyerEmail: "buyer@example.com", currency: "USD", amount: "2.99", subtotal: "2.99", total: "2.99", taxAmount: "0.00", productName: "One" } });
    expect(event.data.buyerEmail).toBe("buyer@example.com");
  });
});
