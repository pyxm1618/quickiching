import postgres, { type Sql } from "postgres";
import { PRODUCTS } from "@/domain/entitlements/pricing";
import { runtimeConfig } from "@/server/config";
import { PostgresPaymentRepository } from "@/server/repositories/postgres/payment-repository";

type PaymentGlobal = typeof globalThis & { __ICHING_PAYMENT_SQL__?: Sql };

export function getPaymentRepository(): PostgresPaymentRepository {
  const config = runtimeConfig();
  if (config.mode !== "production" || config.payment !== "waffo") throw new Error("WAFFO_NOT_ENABLED");
  const globalRef = globalThis as PaymentGlobal;
  globalRef.__ICHING_PAYMENT_SQL__ ??= postgres(config.credentials.databaseUrl, { max: 10, connect_timeout: 10, prepare: true });
  return new PostgresPaymentRepository(globalRef.__ICHING_PAYMENT_SQL__, { products: {
    [config.credentials.waffoProductIdOne]: { internalProductId: "one", quantity: PRODUCTS.one.quantity, amountUsd: PRODUCTS.one.unitPriceUsd },
    [config.credentials.waffoProductIdThree]: { internalProductId: "three", quantity: PRODUCTS.three.quantity, amountUsd: PRODUCTS.three.unitPriceUsd },
    [config.credentials.waffoProductIdFive]: { internalProductId: "five", quantity: PRODUCTS.five.quantity, amountUsd: PRODUCTS.five.unitPriceUsd },
  } });
}

export async function dispatchPaymentOutbox(limit = 25) {
  return getPaymentRepository().dispatchPending(limit);
}
