import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { CreemPaymentProvider } from "./creem-provider";

function signature(body: string, secret = "webhook-secret") {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("CreemPaymentProvider", () => {
  it("creates checkout with a stable request id and internal metadata", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "ch_test",
      checkout_url: "https://checkout.creem.io/ch_test",
      status: "pending",
      request_id: "ord_test",
    }), { status: 200 }));
    const provider = new CreemPaymentProvider({
      apiKey: "creem-key",
      webhookSecret: "webhook-secret",
      baseUrl: "https://test-api.creem.io",
      fetchImpl,
    });

    await expect(provider.createCheckout({
      orderId: "ord_test",
      productId: "prod_test",
      userId: "usr_test",
      customerEmail: "user@example.com",
      successUrl: "https://ichingcoin.com/account?checkout=success",
    })).resolves.toEqual({
      providerCheckoutId: "ch_test",
      checkoutUrl: "https://checkout.creem.io/ch_test",
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://test-api.creem.io/v1/checkouts", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "x-api-key": "creem-key" }),
    }));
    const body = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      product_id: "prod_test",
      request_id: "ord_test",
      units: 1,
      customer: { email: "user@example.com" },
      metadata: { userId: "usr_test", orderId: "ord_test" },
    });
  });

  it("verifies the exact raw body with timing-safe HMAC and parses supported events", () => {
    const rawBody = JSON.stringify({
      id: "evt_1",
      eventType: "checkout.completed",
      object: { request_id: "ord_test", id: "ch_test" },
    });
    const provider = new CreemPaymentProvider({
      apiKey: "creem-key",
      webhookSecret: "webhook-secret",
      baseUrl: "https://api.creem.io",
      fetchImpl: vi.fn(),
    });

    expect(provider.verifyAndParseWebhook(rawBody, signature(rawBody))).toMatchObject({
      providerEventId: "evt_1",
      type: "checkout.completed",
      orderId: "ord_test",
      providerCheckoutId: "ch_test",
    });
    expect(() => provider.verifyAndParseWebhook(`${rawBody} `, signature(rawBody))).toThrow("CREEM_SIGNATURE_INVALID");
    expect(() => provider.verifyAndParseWebhook(rawBody, "not-hex")).toThrow("CREEM_SIGNATURE_INVALID");
  });
});
