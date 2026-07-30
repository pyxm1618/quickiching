import { describe, expect, it, vi } from "vitest";
import { CreemClient } from "./creem-client";

describe("CreemClient", () => {
  it("creates a checkout with the documented endpoint, API key, request id, customer, and metadata", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "ch_test_1",
      status: "pending",
      checkout_url: "https://checkout.creem.io/ch_test_1",
      request_id: "ord_internal_1",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new CreemClient({
      apiKey: "creem_test_key",
      mode: "test",
      fetchImpl,
    });

    const checkout = await client.createCheckout({
      productId: "prod_one",
      requestId: "ord_internal_1",
      successUrl: "https://example.com/checkout/success",
      customerEmail: "buyer@example.com",
      metadata: { orderId: "ord_internal_1", userId: "usr_1" },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://test-api.creem.io/v1/checkouts");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": "creem_test_key",
      },
    });
    expect(JSON.parse(String(init.body))).toEqual({
      product_id: "prod_one",
      request_id: "ord_internal_1",
      units: 1,
      success_url: "https://example.com/checkout/success",
      customer: { email: "buyer@example.com" },
      metadata: { orderId: "ord_internal_1", userId: "usr_1" },
    });
    expect(checkout).toEqual({
      id: "ch_test_1",
      status: "pending",
      checkoutUrl: "https://checkout.creem.io/ch_test_1",
      requestId: "ord_internal_1",
    });
  });

  it.each([
    "http://checkout.creem.io/ch_1",
    "https://evil.example/ch_1",
    "javascript:alert(1)",
  ])("rejects an unsafe checkout redirect: %s", async (checkoutUrl) => {
    const client = new CreemClient({
      apiKey: "creem_prod_key",
      mode: "production",
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({
        id: "ch_unsafe",
        status: "pending",
        checkout_url: checkoutUrl,
        request_id: "ord_unsafe",
      }), { status: 200 })),
    });

    await expect(client.createCheckout({
      productId: "prod_one",
      requestId: "ord_unsafe",
      successUrl: "https://example.com/checkout/success",
      customerEmail: "buyer@example.com",
      metadata: { orderId: "ord_unsafe", userId: "usr_1" },
    })).rejects.toThrow("CREEM_CHECKOUT_URL_INVALID");
  });

  it("surfaces a bounded provider error without returning the provider body", async () => {
    const client = new CreemClient({
      apiKey: "creem_prod_key",
      mode: "production",
      fetchImpl: vi.fn().mockResolvedValue(new Response(
        JSON.stringify({ message: "secret provider diagnostic", trace_id: "trace_1" }),
        { status: 422 },
      )),
    });

    await expect(client.createCheckout({
      productId: "prod_one",
      requestId: "ord_failure",
      successUrl: "https://example.com/checkout/success",
      customerEmail: "buyer@example.com",
      metadata: { orderId: "ord_failure", userId: "usr_1" },
    })).rejects.toThrow("CREEM_CHECKOUT_CREATE_FAILED:422");
  });
});
