import * as z from "zod";

const eventSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().datetime(),
  eventType: z.string().min(1),
  eventId: z.string().min(1),
  storeId: z.string().min(1),
  mode: z.enum(["test", "prod"]),
  data: z.object({
    orderId: z.string().min(1),
    buyerEmail: z.string().email(),
    merchantProvidedBuyerIdentity: z.string().min(1).optional(),
    currency: z.string().min(1),
    amount: z.string().min(1),
    taxAmount: z.string().min(1),
    productName: z.string().min(1),
    orderMerchantExternalId: z.string().min(1).optional(),
    orderMetadata: z.record(z.string(), z.string()).optional(),
    paymentId: z.string().min(1).optional(),
    refundStatus: z.string().min(1).optional(),
    subtotal: z.string().min(1).optional(),
    total: z.string().min(1).optional(),
  }),
});

export type WaffoWebhook = z.infer<typeof eventSchema>;

/** Converts USD display strings to minor units without floating point arithmetic. */
export function usdMinor(value: string): number {
  const match = /^(0|[1-9]\d*)\.(\d{2})$/.exec(value);
  if (!match) throw new Error("WAFFO_AMOUNT_INVALID");
  const dollars = BigInt(match[1]);
  const cents = BigInt(match[2]);
  const total = dollars * 100n + cents;
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("WAFFO_AMOUNT_INVALID");
  return Number(total);
}

export function parseWaffoWebhook(value: unknown): WaffoWebhook {
  const result = eventSchema.safeParse(value);
  if (!result.success) throw new Error("WAFFO_WEBHOOK_SCHEMA_INVALID");
  if (!Number.isFinite(Date.parse(result.data.timestamp))) throw new Error("WAFFO_WEBHOOK_TIMESTAMP_INVALID");
  if (result.data.data.currency.toUpperCase() !== "USD") throw new Error("WAFFO_CURRENCY_INVALID");
  const amount = usdMinor(result.data.data.amount);
  const tax = usdMinor(result.data.data.taxAmount);
  const total = result.data.data.total ? usdMinor(result.data.data.total) : amount;
  const subtotal = result.data.data.subtotal ? usdMinor(result.data.data.subtotal) : total - tax;
  if (subtotal < 0 || subtotal + tax !== total || total !== amount) throw new Error("WAFFO_AMOUNT_INVALID");
  return result.data;
}
