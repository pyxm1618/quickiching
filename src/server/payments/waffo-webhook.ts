import { createHash } from "node:crypto";
import { verifyWebhook } from "@waffo/pancake-ts";
import { z } from "zod";

export type WaffoWebhookErrorCode =
  | "WEBHOOK_SIGNATURE_INVALID"
  | "WEBHOOK_PAYLOAD_INVALID"
  | "WEBHOOK_ENVIRONMENT_MISMATCH"
  | "WEBHOOK_STORE_MISMATCH"
  | "WEBHOOK_CURRENCY_MISMATCH";

export class WaffoWebhookError extends Error {
  constructor(readonly code: WaffoWebhookErrorCode, readonly retryable: boolean) {
    super(code);
    this.name = "WaffoWebhookError";
  }
}

const eventSchema = z.object({
  id: z.string().trim().min(1).max(128),
  timestamp: z.string().datetime({ offset: true }),
  eventType: z.string().trim().min(1).max(128),
  eventId: z.string().trim().min(1).max(128),
  storeId: z.string().trim().min(1).max(128),
  storeName: z.string().max(256),
  mode: z.enum(["test", "prod"]),
  data: z.object({
    orderId: z.string().trim().min(1).max(128),
    merchantProvidedBuyerIdentity: z.string().trim().min(1).max(128).nullable().optional(),
    orderMerchantExternalId: z.string().trim().max(128).optional(),
    currency: z.string().trim().min(1).max(3),
    amount: z.string().trim().min(1).max(32),
    taxAmount: z.string().trim().min(1).max(32),
    total: z.string().trim().min(1).max(32).optional(),
    paymentId: z.string().trim().max(128).optional(),
    refundTicketMerchantExternalId: z.string().trim().max(128).nullable().optional(),
    orderMetadata: z.record(z.string()).optional(),
  }).passthrough(),
}).passthrough();

export type NormalizedWaffoWebhook = {
  provider: "waffo";
  providerEnvironment: "test" | "prod";
  deliveryId: string;
  eventId: string;
  eventType: string;
  storeId: string;
  orderMerchantExternalId: string | null;
  merchantProvidedBuyerIdentity: string | null;
  internalOrderId: string | null;
  refundTicketMerchantExternalId: string | null;
  providerOrderId: string;
  providerPaymentId: string | null;
  productKey: "one" | "three" | "five" | null;
  providerProductId: string | null;
  currency: string;
  amountMinor: number;
  taxAmount: string;
  total: string | null;
  payloadSha256: string;
  canonicalPayloadSha256: string;
  supported: boolean;
  manualReviewReason: "CHARGEBACK_POLICY_UNRESOLVED" | null;
};

function usdMinor(displayAmount: string): number | null {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(displayAmount);
  if (!match) return null;
  const major = Number(match[1]);
  const minorDigits = (match[2] ?? "").padEnd(2, "0");
  const result = major * 100 + Number(minorDigits || "0");
  return Number.isSafeInteger(result) && result >= 0 ? result : null;
}

export function canonicalWaffoPayloadHash(event: Pick<NormalizedWaffoWebhook,
  | "providerEnvironment"
  | "eventId"
  | "eventType"
  | "orderMerchantExternalId"
  | "merchantProvidedBuyerIdentity"
  | "internalOrderId"
  | "productKey"
  | "amountMinor"
  | "currency"
  | "providerOrderId"
  | "providerPaymentId"
  | "providerProductId"
  | "taxAmount"
  | "total"
  | "refundTicketMerchantExternalId"
>): string {
  const canonical = {
    provider: "waffo",
    providerEnvironment: event.providerEnvironment,
    eventType: event.eventType,
    eventId: event.eventId,
    orderMerchantExternalId: event.orderMerchantExternalId,
    merchantProvidedBuyerIdentity: event.merchantProvidedBuyerIdentity,
    internalOrderId: event.internalOrderId,
    productKey: event.productKey,
    amountMinor: event.amountMinor,
    currency: event.currency,
    providerOrderId: event.providerOrderId,
    providerPaymentId: event.providerPaymentId,
    providerProductId: event.providerProductId,
    taxAmount: event.taxAmount,
    total: event.total,
    refundTicketMerchantExternalId: event.refundTicketMerchantExternalId,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function legacyWaffoPayloadHash(event: Pick<NormalizedWaffoWebhook,
  | "providerEnvironment"
  | "eventId"
  | "eventType"
  | "orderMerchantExternalId"
  | "productKey"
  | "amountMinor"
  | "currency"
  | "providerOrderId"
  | "providerPaymentId"
  | "providerProductId"
  | "taxAmount"
  | "total"
>): string {
  const canonical = {
    provider: "waffo",
    providerEnvironment: event.providerEnvironment,
    eventType: event.eventType,
    eventId: event.eventId,
    orderMerchantExternalId: event.orderMerchantExternalId,
    productKey: event.productKey,
    amountMinor: event.amountMinor,
    currency: event.currency,
    providerOrderId: event.providerOrderId,
    providerPaymentId: event.providerPaymentId,
    providerProductId: event.providerProductId,
    taxAmount: event.taxAmount,
    total: event.total,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function verifyAndNormalizeWaffoWebhook(
  rawBody: string,
  signatureHeader: string | null,
  config: { environment: "test" | "prod"; storeId: string; publicKey?: string },
): NormalizedWaffoWebhook {
  let verified: unknown;
  try {
    verified = verifyWebhook(rawBody, signatureHeader, {
      environment: config.environment,
      ...(config.publicKey ? { publicKey: config.publicKey } : {}),
    });
  } catch (error) {
    if (error instanceof SyntaxError) throw new WaffoWebhookError("WEBHOOK_PAYLOAD_INVALID", false);
    throw new WaffoWebhookError("WEBHOOK_SIGNATURE_INVALID", false);
  }

  const parsed = eventSchema.safeParse(verified);
  if (!parsed.success) throw new WaffoWebhookError("WEBHOOK_PAYLOAD_INVALID", false);
  const event = parsed.data;
  if (event.mode !== config.environment) {
    throw new WaffoWebhookError("WEBHOOK_ENVIRONMENT_MISMATCH", false);
  }
  if (event.storeId !== config.storeId) {
    throw new WaffoWebhookError("WEBHOOK_STORE_MISMATCH", false);
  }
  if (event.data.currency !== "USD") {
    throw new WaffoWebhookError("WEBHOOK_CURRENCY_MISMATCH", false);
  }
  const amountMinor = usdMinor(event.data.amount);
  if (amountMinor === null) throw new WaffoWebhookError("WEBHOOK_PAYLOAD_INVALID", false);
  const productKeyCandidate = event.data.orderMetadata?.productKey;
  const productKey = productKeyCandidate === "one" || productKeyCandidate === "three" || productKeyCandidate === "five"
    ? productKeyCandidate
    : null;
  const manualReviewReason = /^(?:chargeback|dispute)\./.test(event.eventType)
    ? "CHARGEBACK_POLICY_UNRESOLVED" as const
    : null;
  const normalized: NormalizedWaffoWebhook = {
    provider: "waffo",
    providerEnvironment: event.mode,
    deliveryId: event.id,
    eventId: event.eventId,
    eventType: event.eventType,
    storeId: event.storeId,
    orderMerchantExternalId: event.data.orderMerchantExternalId ?? null,
    merchantProvidedBuyerIdentity: event.data.merchantProvidedBuyerIdentity ?? null,
    internalOrderId: event.data.orderMetadata?.internalOrderId ?? null,
    refundTicketMerchantExternalId: event.data.refundTicketMerchantExternalId ?? null,
    providerOrderId: event.data.orderId,
    providerPaymentId: event.data.paymentId ?? null,
    productKey,
    providerProductId: event.data.orderMetadata?.providerProductId ?? null,
    currency: event.data.currency,
    amountMinor,
    taxAmount: event.data.taxAmount,
    total: event.data.total ?? null,
    payloadSha256: createHash("sha256").update(rawBody).digest("hex"),
    canonicalPayloadSha256: "",
    supported: event.eventType === "order.completed" || event.eventType === "refund.succeeded" || manualReviewReason !== null,
    manualReviewReason,
  };
  normalized.canonicalPayloadSha256 = canonicalWaffoPayloadHash(normalized);
  return normalized;
}
