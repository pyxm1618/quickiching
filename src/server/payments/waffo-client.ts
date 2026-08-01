import { createHash, sign } from "node:crypto";

const CREATE_SESSION_PATH = "/v1/actions/checkout/create-session";
const WAFFO_API_ORIGIN = "https://api.waffo.ai";
const ALLOWED_CHECKOUT_HOST = "checkout.waffo.ai";

type CheckoutInput = {
  productId: string;
  requestId: string;
  successUrl: string;
  customerEmail: string;
  metadata: Record<string, string>;
};

type WaffoResponse = {
  data?: {
    sessionId?: unknown;
    checkoutUrl?: unknown;
    expiresAt?: unknown;
  };
};

function safeCheckoutUrl(value: unknown): string {
  if (typeof value !== "string") throw new Error("WAFFO_CHECKOUT_URL_INVALID");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("WAFFO_CHECKOUT_URL_INVALID");
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== ALLOWED_CHECKOUT_HOST) {
    throw new Error("WAFFO_CHECKOUT_URL_INVALID");
  }
  return parsed.toString();
}

export function createWaffoRequestSignature(input: {
  method: string;
  path: string;
  timestamp: number;
  body: string;
  privateKey: string;
}): string {
  const bodyHash = createHash("sha256").update(input.body).digest("base64");
  const canonicalRequest = [
    input.method.toUpperCase(),
    input.path,
    String(input.timestamp),
    bodyHash,
  ].join("\n");
  return sign("sha256", Buffer.from(canonicalRequest, "utf8"), input.privateKey).toString("base64");
}

export class WaffoClient {
  constructor(private readonly dependencies: {
    merchantId: string;
    privateKey: string;
    storeId: string;
    fetchImpl?: typeof fetch;
    now?: () => Date;
  }) {}

  async createCheckout(input: CheckoutInput): Promise<{
    id: string;
    status: string;
    checkoutUrl: string;
    requestId: string;
  }> {
    const fetchImpl = this.dependencies.fetchImpl ?? fetch;
    const timestamp = Math.floor((this.dependencies.now?.() ?? new Date()).getTime() / 1000);
    const body = JSON.stringify({
      storeId: this.dependencies.storeId,
      productId: input.productId,
      productType: "onetime",
      currency: "USD",
      buyerEmail: input.customerEmail,
      successUrl: input.successUrl,
      metadata: input.metadata,
      orderMerchantExternalId: input.metadata.orderId,
    });
    const signature = createWaffoRequestSignature({
      method: "POST",
      path: CREATE_SESSION_PATH,
      timestamp,
      body,
      privateKey: this.dependencies.privateKey,
    });
    const response = await fetchImpl(`${WAFFO_API_ORIGIN}${CREATE_SESSION_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-merchant-id": this.dependencies.merchantId,
        "x-timestamp": String(timestamp),
        "x-signature": signature,
      },
      body,
    });
    if (!response.ok) throw new Error(`WAFFO_CHECKOUT_CREATE_FAILED:${response.status}`);
    const payload = await response.json() as WaffoResponse;
    const data = payload.data;
    if (
      typeof data?.sessionId !== "string"
      || typeof data.expiresAt !== "string"
    ) {
      throw new Error("WAFFO_CHECKOUT_RESPONSE_INVALID");
    }
    return {
      id: data.sessionId,
      status: "pending",
      checkoutUrl: safeCheckoutUrl(data.checkoutUrl),
      requestId: input.requestId,
    };
  }
}
