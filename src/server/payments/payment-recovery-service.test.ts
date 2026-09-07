import { describe, expect, it, vi } from "vitest";
import { createPaymentRecoveryService } from "./payment-recovery-service";

const candidate = {
  orderId: "11111111-1111-4111-8111-111111111111",
  environment: "test" as const,
  providerProductId: "PROD_test_three",
  providerOrderId: "ORD_known",
  providerPaymentId: "PAY_known",
  amountMinor: 699,
  currency: "USD" as const,
};

function repository() {
  return {
    listCandidates: vi.fn().mockResolvedValue([candidate]),
    markFinancialReview: vi.fn().mockResolvedValue(undefined),
  };
}

describe("one-time missed payment webhook recovery", () => {
  it("settles exactly one authoritative succeeded one-time payment", async () => {
    const repo = repository();
    const provider = {
      getPayment: vi.fn().mockResolvedValue({
        status: "found",
        payment: {
          environment: "test",
          storeId: "STO_test",
          model: "one_time",
          merchantOrderReference: candidate.orderId,
          providerOrderId: candidate.providerOrderId,
          providerPaymentId: candidate.providerPaymentId,
          providerProductId: candidate.providerProductId,
          status: "succeeded",
          amountMinor: 699,
          currency: "USD",
        },
      }),
    };
    const settle = vi.fn().mockResolvedValue({ outcome: "succeeded" });
    const service = createPaymentRecoveryService({ repository: repo, provider, settle, storeId: "STO_test" });

    await expect(service.run()).resolves.toMatchObject({ checked: 1, settled: 1 });
    expect(provider.getPayment).toHaveBeenCalledWith(expect.objectContaining({
      merchantOrderReference: candidate.orderId,
      providerPaymentId: candidate.providerPaymentId,
      expectedProviderOrderId: candidate.providerOrderId,
      expectedProviderProductId: candidate.providerProductId,
      expectedAmountMinor: 699,
      expectedCurrency: "USD",
    }));
    expect(settle).toHaveBeenCalledWith(expect.objectContaining({
      orderId: candidate.orderId,
      payment: expect.objectContaining({
        providerOrderId: candidate.providerOrderId,
        providerPaymentId: candidate.providerPaymentId,
      }),
      source: "provider_read_reconciliation",
    }));
  });

  it.each(["not_found", "ambiguous", "contract_error"] as const)(
    "never grants on provider read state %s",
    async (status) => {
      const repo = repository();
      const provider = { getPayment: vi.fn().mockResolvedValue({ status }) };
      const settle = vi.fn();
      const service = createPaymentRecoveryService({ repository: repo, provider, settle, storeId: "STO_test" });

      await service.run();
      expect(settle).not.toHaveBeenCalled();
      if (status === "ambiguous" || status === "contract_error") {
        expect(repo.markFinancialReview).toHaveBeenCalledTimes(1);
      }
    },
  );

  it("does not grant a non-succeeded provider payment", async () => {
    const repo = repository();
    const provider = {
      getPayment: vi.fn().mockResolvedValue({
        status: "found",
        payment: {
          environment: "test", storeId: "STO_test", model: "one_time",
          merchantOrderReference: candidate.orderId, providerOrderId: candidate.providerOrderId, providerPaymentId: candidate.providerPaymentId,
          providerProductId: candidate.providerProductId, status: "pending", amountMinor: 699, currency: "USD",
        },
      }),
    };
    const settle = vi.fn();
    const service = createPaymentRecoveryService({ repository: repo, provider, settle, storeId: "STO_test" });
    await service.run();
    expect(settle).not.toHaveBeenCalled();
  });
});
