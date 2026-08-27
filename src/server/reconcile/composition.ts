import { getPostgresClient } from "@/server/db/client";
import { PostgresPaymentRepository } from "@/server/payments/postgres-repository";
import { createOutboxDispatcher } from "@/server/payments/outbox-dispatcher";
import { createReconcileService, type ReconcileService } from "./reconcile-service";

let cachedService: ReconcileService | null = null;

export async function createProductionReconcileService(): Promise<ReconcileService> {
  if (cachedService) return cachedService;

  const sql = getPostgresClient();
  const paymentRepository = new PostgresPaymentRepository(sql, {
    checkoutUrlKeys: process.env.PAYMENT_CHECKOUT_URL_KEYS,
  });
  const outboxDispatcher = createOutboxDispatcher({ sql, repository: paymentRepository });
  cachedService = createReconcileService({ sql, outboxDispatcher });
  return cachedService;
}
