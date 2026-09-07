import { describe, expect, it, vi } from "vitest";
import { createRefundReconciliationService, type RefundReconciliationCandidate } from "./refund-reconciliation-service";

function candidate(): RefundReconciliationCandidate {
  return {
    refundId: "11111111-1111-4111-8111-111111111111",
    orderId: "22222222-2222-4222-8222-222222222222",
    userId: "user-1",
    environment: "test",
    providerOrderId: "ORD_1",
    providerPaymentId: "PAY_1",
    providerProductId: "PROD_test_three",
    requestedMinor: 699,
    paymentAmountMinor: 699,
    currency: "USD",
    providerTicketId: null,
    leaseToken: "lease-1",
    reconcileAttemptCount: 1,
  };
}

function repository() {
  return {
    claimBatch: vi.fn().mockResolvedValue([candidate()]),
    reschedule: vi.fn().mockResolvedValue(undefined),
    markManualReview: vi.fn().mockResolvedValue(undefined),
  };
}

describe("refund reconciliation service", () => {
  it("settles succeeded provider reads through the shared settlement core", async () => {
    const repo = repository();
    const provider = {
      getRefundSettlement: vi.fn().mockResolvedValue({
        status: "succeeded",
        providerTicketId: "RT_1",
        providerRefundId: "RF_1",
        amountMinor: 699,
        currency: "USD",
      }),
    };
    const settle = vi.fn().mockResolvedValue({ outcome: "succeeded" });
    const service = createRefundReconciliationService({
      repository: repo,
      provider,
      settle,
      storeId: "STO_test",
      now: () => new Date("2026-09-07T03:00:00.000Z"),
    });

    await expect(service.run()).resolves.toMatchObject({ claimed: 1, settled: 1 });
    expect(provider.getRefundSettlement).toHaveBeenCalledTimes(1);
    expect(provider.getRefundSettlement).toHaveBeenCalledWith(expect.objectContaining({
      expectedProviderOrderId: "ORD_1",
    }));
    expect(settle).toHaveBeenCalledWith(expect.objectContaining({
      refundId: candidate().refundId,
      orderId: candidate().orderId,
      providerTicketId: "RT_1",
      providerRefundId: "RF_1",
      status: "succeeded",
      source: "provider_read",
      reconcileLeaseToken: "lease-1",
    }));
    expect(repo.reschedule).not.toHaveBeenCalled();
  });

  it("settles refund.failed without converting it into a retry or write", async () => {
    const repo = repository();
    const provider = {
      getRefundSettlement: vi.fn().mockResolvedValue({
        status: "failed",
        providerTicketId: "RT_1",
        providerRefundId: null,
        amountMinor: 699,
        currency: "USD",
      }),
    };
    const settle = vi.fn().mockResolvedValue({ outcome: "failed" });
    const service = createRefundReconciliationService({
      repository: repo,
      provider,
      settle,
      storeId: "STO_test",
    });

    await service.run();
    expect(settle).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
    expect(repo.reschedule).not.toHaveBeenCalled();
  });

  it.each(["found_pending", "found_processing", "not_found", "ambiguous"] as const)(
    "reschedules provider READ state %s without any provider write path",
    async (status) => {
      const repo = repository();
      const provider = {
        getRefundSettlement: vi.fn().mockResolvedValue(
          status === "found_pending" || status === "found_processing"
            ? { status, providerTicketId: "RT_1", providerRefundId: null, amountMinor: 699, currency: "USD" }
            : { status },
        ),
      };
      const settle = vi.fn();
      const service = createRefundReconciliationService({
        repository: repo,
        provider,
        settle,
        storeId: "STO_test",
      });

      await service.run();
      expect(settle).not.toHaveBeenCalled();
      expect(repo.reschedule).toHaveBeenCalledTimes(1);
    },
  );

  it("fails closed to manual review on provider contract_error", async () => {
    const repo = repository();
    const provider = { getRefundSettlement: vi.fn().mockResolvedValue({ status: "contract_error" }) };
    const service = createRefundReconciliationService({
      repository: repo,
      provider,
      settle: vi.fn(),
      storeId: "STO_test",
    });

    await service.run();
    expect(repo.markManualReview).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: "REFUND_PROVIDER_READ_CONTRACT_ERROR",
    }));
    expect(repo.reschedule).not.toHaveBeenCalled();
  });

  it("reschedules transport failures and never turns them into another refund POST", async () => {
    const repo = repository();
    const provider = { getRefundSettlement: vi.fn().mockRejectedValue(new Error("socket reset")) };
    const service = createRefundReconciliationService({
      repository: repo,
      provider,
      settle: vi.fn(),
      storeId: "STO_test",
    });

    await service.run();
    expect(repo.reschedule).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: "REFUND_PROVIDER_READ_UNAVAILABLE",
    }));
  });
});
