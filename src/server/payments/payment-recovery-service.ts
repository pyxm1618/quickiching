import type { AuthoritativePayment, OneTimePaymentAuthority } from "./provider-authority";

export type PaymentRecoveryCandidate = {
  orderId: string;
  environment: "test" | "prod";
  providerProductId: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  amountMinor: number;
  currency: "USD";
};

export type PaymentRecoveryRepository = {
  listCandidates(input: { limit: number; now: Date }): Promise<PaymentRecoveryCandidate[]>;
  markFinancialReview(input: { orderId: string; errorCode: string; now: Date }): Promise<void>;
};

type PaymentRecoverySettlement = (input: {
  orderId: string;
  payment: AuthoritativePayment;
  source: "provider_read_reconciliation";
  now: Date;
}) => Promise<{ outcome: "succeeded" | "already_settled" | "financial_review" }>;

export function createPaymentRecoveryService(dependencies: {
  repository: PaymentRecoveryRepository;
  provider: Pick<OneTimePaymentAuthority, "getPayment">;
  settle: PaymentRecoverySettlement;
  storeId: string;
  now?: () => Date;
}) {
  const now = dependencies.now ?? (() => new Date());

  return {
    async run(options: { limit?: number } = {}): Promise<{ checked: number; settled: number; reviewed: number }> {
      const startedAt = now();
      const candidates = await dependencies.repository.listCandidates({
        limit: Math.max(1, Math.min(options.limit ?? 5, 20)),
        now: startedAt,
      });
      let settled = 0;
      let reviewed = 0;

      for (const candidate of candidates) {
        let lookup: Awaited<ReturnType<OneTimePaymentAuthority["getPayment"]>>;
        try {
          lookup = await dependencies.provider.getPayment({
            environment: candidate.environment,
            storeId: dependencies.storeId,
            merchantOrderReference: candidate.orderId,
            ...(candidate.providerPaymentId ? { providerPaymentId: candidate.providerPaymentId } : {}),
            ...(candidate.providerOrderId ? { expectedProviderOrderId: candidate.providerOrderId } : {}),
            expectedProviderProductId: candidate.providerProductId,
            expectedAmountMinor: candidate.amountMinor,
            expectedCurrency: candidate.currency,
          });
        } catch {
          await dependencies.repository.markFinancialReview({
            orderId: candidate.orderId,
            errorCode: "PAYMENT_PROVIDER_READ_UNAVAILABLE",
            now: now(),
          });
          reviewed++;
          continue;
        }

        if (lookup.status === "found" && lookup.payment.status === "succeeded") {
          const result = await dependencies.settle({
            orderId: candidate.orderId,
            payment: lookup.payment,
            source: "provider_read_reconciliation",
            now: now(),
          });
          if (result.outcome === "succeeded" || result.outcome === "already_settled") settled++;
          else reviewed++;
          continue;
        }

        if (lookup.status === "ambiguous" || lookup.status === "contract_error") {
          await dependencies.repository.markFinancialReview({
            orderId: candidate.orderId,
            errorCode: lookup.status === "ambiguous"
              ? "PAYMENT_PROVIDER_READ_AMBIGUOUS"
              : "PAYMENT_PROVIDER_READ_CONTRACT_ERROR",
            now: now(),
          });
          reviewed++;
        }
      }

      return { checked: candidates.length, settled, reviewed };
    },
  };
}
