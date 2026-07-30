import postgres, { type Sql } from "postgres";
import { PRODUCTS } from "@/domain/entitlements/pricing";
import { verifyCreemSignature } from "@/server/payments/creem-signature";
import { parseCreemWebhook } from "@/server/payments/creem-webhook";
import { PostgresPaymentRepository } from "@/server/repositories/postgres/payment-repository";

export const runtime = "nodejs";

type PaymentGlobal = typeof globalThis & { __ICHING_PAYMENT_SQL__?: Sql };

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`PAYMENT_CONFIG_MISSING:${name}`);
  return value;
}

function paymentRepository(): PostgresPaymentRepository {
  const globalRef = globalThis as PaymentGlobal;
  globalRef.__ICHING_PAYMENT_SQL__ ??= postgres(required("DATABASE_URL"), {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: true,
  });
  return new PostgresPaymentRepository(globalRef.__ICHING_PAYMENT_SQL__, {
    products: {
      [required("CREEM_PRODUCT_ONE_ID")]: {
        internalProductId: "one",
        quantity: PRODUCTS.one.quantity,
        amountUsd: PRODUCTS.one.unitPriceUsd,
      },
      [required("CREEM_PRODUCT_THREE_ID")]: {
        internalProductId: "three",
        quantity: PRODUCTS.three.quantity,
        amountUsd: PRODUCTS.three.unitPriceUsd,
      },
      [required("CREEM_PRODUCT_FIVE_ID")]: {
        internalProductId: "five",
        quantity: PRODUCTS.five.quantity,
        amountUsd: PRODUCTS.five.unitPriceUsd,
      },
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("creem-signature");
  if (!verifyCreemSignature(rawBody, signature, required("CREEM_WEBHOOK_SECRET"))) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  try {
    const event = parseCreemWebhook(rawBody);
    if ("ignored" in event) {
      return Response.json({ received: true, ignored: true });
    }
    const outcome = await paymentRepository().processCheckoutCompleted(event);
    return Response.json({ received: true, duplicate: outcome.duplicate });
  } catch (error) {
    const code = error instanceof Error ? error.message.split(":", 1)[0] : "CREEM_WEBHOOK_FAILED";
    console.error("Creem webhook processing failed", { code });
    return Response.json({ error: "webhook_processing_failed" }, { status: 400 });
  }
}
