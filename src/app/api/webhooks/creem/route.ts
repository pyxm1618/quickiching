import postgres, { type Sql } from "postgres";
import { PRODUCTS } from "@/domain/entitlements/pricing";
import { runtimeConfig } from "@/server/config";
import { DomainError } from "@/server/errors/domain-error";
import { verifyCreemSignature } from "@/server/payments/creem-signature";
import { parseCreemWebhook } from "@/server/payments/creem-webhook";
import { PostgresPaymentRepository } from "@/server/repositories/postgres/payment-repository";

export const runtime = "nodejs";

type PaymentGlobal = typeof globalThis & { __ICHING_PAYMENT_SQL__?: Sql };

function productionConfig() {
  const config = runtimeConfig();
  if (config.mode !== "production") throw new Error("CREEM_NOT_ENABLED");
  return config;
}

function paymentRepository(): PostgresPaymentRepository {
  const config = productionConfig();
  const globalRef = globalThis as PaymentGlobal;
  globalRef.__ICHING_PAYMENT_SQL__ ??= postgres(config.credentials.databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: true,
  });
  return new PostgresPaymentRepository(globalRef.__ICHING_PAYMENT_SQL__, {
    products: {
      [config.credentials.creemProductIdOne]: {
        internalProductId: "one",
        quantity: PRODUCTS.one.quantity,
        amountUsd: PRODUCTS.one.unitPriceUsd,
      },
      [config.credentials.creemProductIdThree]: {
        internalProductId: "three",
        quantity: PRODUCTS.three.quantity,
        amountUsd: PRODUCTS.three.unitPriceUsd,
      },
      [config.credentials.creemProductIdFive]: {
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
  const config = productionConfig();
  if (!verifyCreemSignature(rawBody, signature, config.credentials.creemWebhookSecret)) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  try {
    const event = parseCreemWebhook(rawBody);
    if ("ignored" in event) {
      return Response.json({ received: true, ignored: true });
    }
    const outcome = await paymentRepository().processEvent(event);
    return Response.json({
      received: true,
      duplicate: outcome.duplicate,
      financialReviewRequired: outcome.financialReviewRequired ?? false,
    });
  } catch (error) {
    const code = error instanceof DomainError
      ? error.code
      : error instanceof Error
        ? error.message.split(":", 1)[0]
        : "CREEM_WEBHOOK_FAILED";
    console.error("Creem webhook processing failed", { code });
    const retryable = error instanceof DomainError && error.retryable;
    return Response.json(
      { error: "webhook_processing_failed" },
      { status: retryable ? 503 : 400 },
    );
  }
}
