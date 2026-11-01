import { z } from "zod";
const refundSchema = z.object({ id: z.string(), status: z.string(), autoScreen: z.string(), screenReason: z.string().nullable() });
const accountSchema = z.object({
  email: z.string().email(),
  signInMethods: z.array(z.string()),
  balance: z.object({ available: z.number().int().nonnegative(), expiringSoon: z.number().int().nonnegative() }),
  purchases: z.array(z.object({
    id: z.string(), productKey: z.enum(["one", "three", "five"]), quantity: z.number().int().positive(),
    amountMinor: z.number().int().nonnegative(), currency: z.literal("USD"), status: z.string(),
    paidAt: z.string().datetime().nullable().transform(value => value === null ? null : new Date(value)),
    createdAt: z.string().datetime().transform(value => new Date(value)), refund: refundSchema.nullable(),
  })),
});
export async function fetchAccountModal() {
  const response = await fetch("/api/user/me?view=account", { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error("ACCOUNT_UNAVAILABLE");
  return accountSchema.parse(await response.json());
}
