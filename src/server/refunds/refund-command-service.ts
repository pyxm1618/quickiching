import {
  RefundWriteNotDispatchedError,
  RefundWriteRejectedError,
  type RefundProviderAuthority,
  type RefundWriteResult,
} from "@/server/payments/provider-authority";

export type RefundDispatchClaim = {
  mode: "dispatch" | "read_only";
  refundId: string;
  orderId: string;
  userId: string;
  environment: "test" | "prod";
  providerPaymentId: string;
  providerProductId: string;
  requestedMinor: number;
  currency: "USD";
  reason: string;
};

export type RefundCommandRepository = {
  claimProviderDispatch(refundId: string, now: Date): Promise<RefundDispatchClaim>;
  markProviderDispatchConfirmed(input: {
    refundId: string;
    result: RefundWriteResult;
    now: Date;
  }): Promise<void>;
  markProviderDispatchAmbiguous(input: {
    refundId: string;
    errorCode: string;
    now: Date;
  }): Promise<void>;
  releaseProviderDispatchNotSent(input: {
    refundId: string;
    errorCode: string;
    now: Date;
  }): Promise<void>;
  markProviderDispatchRejected(input: {
    refundId: string;
    errorCode: string;
    now: Date;
  }): Promise<void>;
};

function safeErrorCode(error: unknown): string {
  const value = error instanceof Error ? error.message.trim() : "REFUND_PROVIDER_WRITE_FAILED";
  return /^[A-Z][A-Z0-9_]{0,63}$/.test(value) ? value : "REFUND_PROVIDER_WRITE_OUTCOME_UNKNOWN";
}

export function createRefundCommandService(dependencies: {
  repository: RefundCommandRepository;
  provider: Pick<RefundProviderAuthority, "requestRefund">;
  storeId: string;
  now?: () => Date;
}) {
  const now = dependencies.now ?? (() => new Date());

  return {
    async execute(refundId: string): Promise<{ outcome: "dispatched" | "read_only" }> {
      const startedAt = now();
      const claim = await dependencies.repository.claimProviderDispatch(refundId, startedAt);
      if (claim.mode !== "dispatch") return { outcome: "read_only" };

      try {
        const result = await dependencies.provider.requestRefund({
          environment: claim.environment,
          storeId: dependencies.storeId,
          buyerIdentity: claim.userId,
          providerPaymentId: claim.providerPaymentId,
          merchantOrderReference: claim.orderId,
          expectedProviderProductId: claim.providerProductId,
          amountMinor: claim.requestedMinor,
          currency: claim.currency,
          reason: claim.reason,
          refundIntentId: claim.refundId,
        });

        // Persisting the confirmed provider response is part of the uncertain
        // write window: if this local write fails after Waffo accepted the POST,
        // the next worker must reconcile by provider READ, never POST again.
        await dependencies.repository.markProviderDispatchConfirmed({
          refundId: claim.refundId,
          result,
          now: now(),
        });
        return { outcome: "dispatched" };
      } catch (error) {
        if (error instanceof RefundWriteNotDispatchedError) {
          await dependencies.repository.releaseProviderDispatchNotSent({
            refundId: claim.refundId,
            errorCode: error.code,
            now: now(),
          });
          throw new Error("REFUND_PROVIDER_WRITE_NOT_DISPATCHED");
        }

        if (error instanceof RefundWriteRejectedError) {
          await dependencies.repository.markProviderDispatchRejected({
            refundId: claim.refundId,
            errorCode: error.code,
            now: now(),
          });
          throw new Error("REFUND_PROVIDER_REJECTED");
        }

        try {
          await dependencies.repository.markProviderDispatchAmbiguous({
            refundId: claim.refundId,
            errorCode: safeErrorCode(error),
            now: now(),
          });
        } catch {
          // The durable dispatch fence was already committed before the provider
          // call. Even if ambiguity persistence itself fails, future claims must
          // see dispatched/attempt=1 and stay read-only.
        }
        throw new Error("REFUND_PROVIDER_WRITE_OUTCOME_UNKNOWN");
      }
    },
  };
}
