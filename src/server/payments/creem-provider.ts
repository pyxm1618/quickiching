import { createHmac, timingSafeEqual } from "node:crypto";
import * as z from "zod";
import type { CheckoutInput, CheckoutReference, PaymentEvent, PaymentEventType, PaymentProvider } from "./provider";

const checkoutResponseSchema = z.object({
  id: z.string().min(1),
  checkout_url: z.string().url(),
});

const supportedEvent = z.enum(["checkout.completed", "refund.created", "dispute.created"]);

function safeSignatureEqual(expected: string, received: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function stringAt(value: unknown, ...keys: string[]): string | undefined {
  let current = value;
  for (const key of keys) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : undefined;
}

export class CreemPaymentProvider implements PaymentProvider {
  constructor(private readonly dependencies: {
    apiKey: string;
    webhookSecret: string;
    baseUrl: string;
    fetchImpl?: typeof fetch;
  }) {
    if (!dependencies.apiKey || !dependencies.webhookSecret) throw new Error("CREEM_CREDENTIALS_REQUIRED");
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutReference> {
    const response = await (this.dependencies.fetchImpl ?? fetch)(`${this.dependencies.baseUrl}/v1/checkouts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.dependencies.apiKey,
      },
      body: JSON.stringify({
        product_id: input.productId,
        request_id: input.orderId,
        units: 1,
        customer: { email: input.customerEmail },
        success_url: input.successUrl,
        metadata: { userId: input.userId, orderId: input.orderId },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`CREEM_CHECKOUT_FAILED:${response.status}`);
    const parsed = checkoutResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("CREEM_CHECKOUT_RESPONSE_INVALID");
    return { providerCheckoutId: parsed.data.id, checkoutUrl: parsed.data.checkout_url };
  }

  verifyAndParseWebhook(rawBody: string, signature: string): PaymentEvent {
    const expected = createHmac("sha256", this.dependencies.webhookSecret).update(rawBody).digest("hex");
    if (!safeSignatureEqual(expected, signature)) throw new Error("CREEM_SIGNATURE_INVALID");

    let raw: unknown;
    try { raw = JSON.parse(rawBody); }
    catch { throw new Error("CREEM_WEBHOOK_INVALID_JSON"); }
    if (typeof raw !== "object" || raw === null) throw new Error("CREEM_WEBHOOK_INVALID");
    const object = raw as Record<string, unknown>;
    const typeResult = supportedEvent.safeParse(object.eventType ?? object.event_type ?? object.type);
    if (!typeResult.success) throw new Error("CREEM_EVENT_UNSUPPORTED");
    const type = typeResult.data as PaymentEventType;
    const providerEventId = typeof object.id === "string" ? object.id : undefined;
    const orderId =
      stringAt(object, "object", "request_id")
      ?? stringAt(object, "data", "request_id")
      ?? stringAt(object, "metadata", "orderId")
      ?? stringAt(object, "object", "metadata", "orderId");
    const providerCheckoutId =
      stringAt(object, "object", "checkout_id")
      ?? stringAt(object, "object", "id")
      ?? stringAt(object, "data", "checkout_id")
      ?? stringAt(object, "data", "id");
    if (!providerEventId || !orderId || !providerCheckoutId) throw new Error("CREEM_EVENT_INVALID");
    return { providerEventId, type, orderId, providerCheckoutId, raw };
  }
}
