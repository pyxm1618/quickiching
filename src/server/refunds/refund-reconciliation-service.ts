import type { RefundProviderAuthority } from "@/server/payments/provider-authority";
import type { RefundSettlementResult } from "./refund-settlement-core";

export type RefundReconciliationCandidate = {
  refundId: string;
  orderId: string;
  userId: string;
  environment: "test" | "prod";
  providerOrderId: string;
  providerPaymentId: string;
  providerProductId: string;
  requestedMinor: number;
  paymentAmountMinor: number;
  currency: "USD";
  providerTicketId: string | null;
  leaseToken: string;
  reconcileAttemptCount: number;
};

export type RefundReconciliationRepository = {
  claimBatch(options?: { limit?: number; leaseDurationMs?: number; now?: Date }): Promise<RefundReconciliationCandidate[]>;
  reschedule(input: {
    refundId: string;
    leaseToken: string;
    providerTicketId?: string | null;
    errorCode: string;
    now: Date;
  }): Promise<void>;
  markManualReview(input: {
    refundId: string;
    leaseToken: string;
    errorCode: string;
    now: Date;
  }): Promise<void>;
};

type SettlementInput = {
  refundId: string;
  orderId: string;
  environment: "test" | "prod";
  providerOrderId: string;
  providerPaymentId: string;
  amountMinor: number;
  currency: "USD";
  providerTicketId: string | null;
  providerRefundId: string | null;
  status: "succeeded" | "failed";
  source: "provider_read";
  webhookInboxId: null;
  reconcileLeaseToken: string;
  now: Date;
};

export function createRefundReconciliationService(dependencies: {
  repository: RefundReconciliationRepository;
  provider: Pick<RefundProviderAuthority, "getRefundSettlement">;
  settle(input: SettlementInput): Promise<RefundSettlementResult>;
  storeId: string;
  now?: () => Date;
}) {
  const now = dependencies.now ?? (() => new Date());

  return {
    async run(options: { limit?: number } = {}): Promise<{
      claimed: number;
      settled: number;
      rescheduled: number;
      manualReview: number;
      leaseLost: number;
    }> {
      const candidates = await dependencies.repository.claimBatch({ limit: options.limit, now: now() });
      let settled = 0;
      let rescheduled = 0;
      let manualReview = 0;
      let leaseLost = 0;

      for (const candidate of candidates) {
        let lookup: Awaited<ReturnType<RefundProviderAuthority["getRefundSettlement"]>>;
        try {
          lookup = await dependencies.provider.getRefundSettlement({
            environment: candidate.environment,
            storeId: dependencies.storeId,
            providerPaymentId: candidate.providerPaymentId,
            merchantOrderReference: candidate.orderId,
            expectedProviderOrderId: candidate.providerOrderId,
            expectedProviderProductId: candidate.providerProductId,
            paymentAmountMinor: candidate.paymentAmountMinor,
            amountMinor: candidate.requestedMinor,
            currency: candidate.currency,
            refundIntentId: candidate.refundId,
            ...(candidate.providerTicketId ? { providerTicketId: candidate.providerTicketId } : {}),
          });
        } catch {
          await dependencies.repository.reschedule({
            refundId: candidate.refundId,
            leaseToken: candidate.leaseToken,
            errorCode: "REFUND_PROVIDER_READ_UNAVAILABLE",
            now: now(),
          });
          rescheduled++;
          continue;
        }

        if (lookup.status === "succeeded" || lookup.status === "failed") {
          try {
            await dependencies.settle({
              refundId: candidate.refundId,
              orderId: candidate.orderId,
              environment: candidate.environment,
              providerOrderId: candidate.providerOrderId,
              providerPaymentId: candidate.providerPaymentId,
              amountMinor: lookup.amountMinor,
              currency: lookup.currency,
              providerTicketId: lookup.providerTicketId,
              providerRefundId: lookup.providerRefundId,
              status: lookup.status,
              source: "provider_read",
              webhookInboxId: null,
              reconcileLeaseToken: candidate.leaseToken,
              now: now(),
            });
            settled++;
          } catch (error) {
            if (error instanceof Error && error.message === "REFUND_RECONCILE_LEASE_LOST") {
              // A webhook or another legitimate settlement path won while the
              // provider READ was in flight. The fresh authoritative state is
              // already in the database; a stale worker must simply stop.
              leaseLost++;
              continue;
            }
            throw error;
          }
          continue;
        }

        if (lookup.status === "contract_error") {
          await dependencies.repository.markManualReview({
            refundId: candidate.refundId,
            leaseToken: candidate.leaseToken,
            errorCode: "REFUND_PROVIDER_READ_CONTRACT_ERROR",
            now: now(),
          });
          manualReview++;
          continue;
        }

        await dependencies.repository.reschedule({
          refundId: candidate.refundId,
          leaseToken: candidate.leaseToken,
          providerTicketId: lookup.status === "found_pending" || lookup.status === "found_processing"
            ? lookup.providerTicketId
            : null,
          errorCode: lookup.status === "not_found"
            ? "REFUND_PROVIDER_READ_NOT_FOUND"
            : lookup.status === "ambiguous"
              ? "REFUND_PROVIDER_READ_AMBIGUOUS"
              : "REFUND_PROVIDER_READ_PENDING",
          now: now(),
        });
        rescheduled++;
      }

      return { claimed: candidates.length, settled, rescheduled, manualReview, leaseLost };
    },
  };
}
