type CreemMode = "test" | "production";

type CheckoutInput = {
  productId: string;
  requestId: string;
  successUrl: string;
  customerEmail: string;
  metadata: Record<string, string>;
};

type CreemCheckoutResponse = {
  id?: unknown;
  status?: unknown;
  checkout_url?: unknown;
  request_id?: unknown;
};

const ALLOWED_CHECKOUT_HOSTS = new Set(["checkout.creem.io", "test-checkout.creem.io"]);

function validateCheckoutUrl(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("CREEM_CHECKOUT_URL_INVALID");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("CREEM_CHECKOUT_URL_INVALID");
  }
  if (url.protocol !== "https:" || !ALLOWED_CHECKOUT_HOSTS.has(url.hostname)) {
    throw new Error("CREEM_CHECKOUT_URL_INVALID");
  }
  return url.toString();
}

export class CreemClient {
  constructor(private readonly dependencies: {
    apiKey: string;
    mode: CreemMode;
    fetchImpl?: typeof fetch;
  }) {}

  async createCheckout(input: CheckoutInput): Promise<{
    id: string;
    status: string;
    checkoutUrl: string;
    requestId: string;
  }> {
    const fetchImpl = this.dependencies.fetchImpl ?? fetch;
    const baseUrl = this.dependencies.mode === "test"
      ? "https://test-api.creem.io"
      : "https://api.creem.io";
    const response = await fetchImpl(`${baseUrl}/v1/checkouts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.dependencies.apiKey,
      },
      body: JSON.stringify({
        product_id: input.productId,
        request_id: input.requestId,
        units: 1,
        success_url: input.successUrl,
        customer: { email: input.customerEmail },
        metadata: input.metadata,
      }),
    });
    if (!response.ok) {
      throw new Error(`CREEM_CHECKOUT_CREATE_FAILED:${response.status}`);
    }
    const body = await response.json() as CreemCheckoutResponse;
    if (
      typeof body.id !== "string"
      || typeof body.status !== "string"
      || typeof body.request_id !== "string"
    ) {
      throw new Error("CREEM_CHECKOUT_RESPONSE_INVALID");
    }
    return {
      id: body.id,
      status: body.status,
      checkoutUrl: validateCheckoutUrl(body.checkout_url),
      requestId: body.request_id,
    };
  }
}
