import { getPostgresClient } from "@/server/db/client";
import { CloseoutPaymentRepository } from "@/server/payments/closeout-repository";
import { createOutboxDispatcher } from "@/server/payments/outbox-dispatcher";
import { createPaymentRecoveryService } from "@/server/payments/payment-recovery-service";
import { applyAuthoritativePaymentSettlement } from "@/server/payments/payment-provider-read-settlement";
import { PostgresPaymentRecoveryRepository } from "@/server/payments/postgres-payment-recovery";
import { resolveWaffoRuntimeConfig } from "@/server/payments/waffo-adapter";
import { createWaffoAuthority } from "@/server/payments/waffo-authority";
import { PostgresRefundReconciliationRepository } from "@/server/refunds/postgres-refund-reconciliation";
import { createRefundReconciliationService } from "@/server/refunds/refund-reconciliation-service";
import { applyRefundSettlement } from "@/server/refunds/refund-settlement-core";
import { createReconcileService, type ReconcileService } from "./reconcile-service";

let cachedService: ReconcileService | null = null;

export async function createProductionReconcileService(): Promise<ReconcileService> {
  if (cachedService) return cachedService;

  const sql = getPostgresClient();
  const paymentRepository = new CloseoutPaymentRepository(sql, {
    checkoutUrlKeys: process.env.PAYMENT_CHECKOUT_URL_KEYS,
  });
  const outboxDispatcher = createOutboxDispatcher({ sql, repository: paymentRepository });
  const waffo = resolveWaffoRuntimeConfig(process.env);
  const authority = createWaffoAuthority(waffo);

  const paymentRecovery = createPaymentRecoveryService({
    repository: new PostgresPaymentRecoveryRepository(sql),
    provider: authority,
    settle: (input) => applyAuthoritativePaymentSettlement(sql, input),
    storeId: waffo.storeId,
  });

  const refundReconciliation = createRefundReconciliationService({
    repository: new PostgresRefundReconciliationRepository(sql),
    provider: authority,
    settle: (input) => applyRefundSettlement(sql, input),
    storeId: waffo.storeId,
  });

  cachedService = createReconcileService({
    sql,
    outboxDispatcher,
    paymentRecovery,
    refundReconciliation,
  });
  return cachedService;
}
