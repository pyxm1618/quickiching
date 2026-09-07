import { describe, expect, it, vi } from "vitest";
import {
  RefundWriteNotDispatchedError,
  RefundWriteRejectedError,
} from "@/server/payments/provider-authority";
import { createRefundCommandService, type RefundDispatchClaim } from "./refund-command-service";

const baseClaim: RefundDispatchClaim = {
  mode: "dispatch",
  refundId: "22222222-2222-4222-8222-222222222222",
  orderId: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  environment: "test",
  providerPaymentId: "PAY_test",
  providerProductId: "PROD_test_three",
  requestedMinor: 699,
  currency: "USD",
  reason: "Customer request",
};

function provider(requestRefund: ReturnType<typeof vi.fn>) {
  return {
    requestRefund,
    getPayment: vi.fn(),
    getRefundSettlement: vi.fn(),
  } as never;
}

function repository(claimProviderDispatch: ReturnType<typeof vi.fn>) {
  return {
    claimProviderDispatch,
    markProviderDispatchConfirmed: vi.fn(async () => undefined),
    markProviderDispatchAmbiguous: vi.fn(async () => undefined),
    releaseProviderDispatchNotSent: vi.fn(async () => undefined),
    markProviderDispatchRejected: vi.fn(async () => undefined),
  };
}

describe("refund command provider-write fence", () => {
  it("calls the provider at most once after the durable dispatch claim", async () => {
    const claimProviderDispatch = vi.fn()
      .mockResolvedValueOnce(baseClaim)
      .mockResolvedValueOnce({ ...baseClaim, mode: "read_only" as const });
    const repo = repository(claimProviderDispatch);
    const requestRefund = vi.fn(async () => ({ providerTicketId: "RT_test", status: "pending" as const }));
    const service = createRefundCommandService({
      repository: repo,
      provider: provider(requestRefund),
      storeId: "STO_test",
      now: () => new Date("2026-09-07T00:00:00.000Z"),
    });

    await expect(service.execute(baseClaim.refundId)).resolves.toEqual({ outcome: "dispatched" });
    await expect(service.execute(baseClaim.refundId)).resolves.toEqual({ outcome: "read_only" });

    expect(requestRefund).toHaveBeenCalledTimes(1);
    expect(repo.markProviderDispatchConfirmed).toHaveBeenCalledTimes(1);
    expect(repo.markProviderDispatchAmbiguous).not.toHaveBeenCalled();
    expect(repo.releaseProviderDispatchNotSent).not.toHaveBeenCalled();
    expect(repo.markProviderDispatchRejected).not.toHaveBeenCalled();
  });

  it("releases the fence only when the adapter proves the refund POST was not dispatched", async () => {
    const claimProviderDispatch = vi.fn().mockResolvedValue(baseClaim);
    const repo = repository(claimProviderDispatch);
    const requestRefund = vi.fn(async () => {
      throw new RefundWriteNotDispatchedError("REFUND_PAYMENT_NOT_AUTHORITATIVE");
    });
    const service = createRefundCommandService({
      repository: repo,
      provider: provider(requestRefund),
      storeId: "STO_test",
      now: () => new Date("2026-09-07T00:00:00.000Z"),
    });

    await expect(service.execute(baseClaim.refundId)).rejects.toThrow("REFUND_PROVIDER_WRITE_NOT_DISPATCHED");

    expect(requestRefund).toHaveBeenCalledTimes(1);
    expect(repo.releaseProviderDispatchNotSent).toHaveBeenCalledTimes(1);
    expect(repo.markProviderDispatchRejected).not.toHaveBeenCalled();
    expect(repo.markProviderDispatchAmbiguous).not.toHaveBeenCalled();
  });

  it("records a definite provider rejection as terminal instead of ambiguous", async () => {
    const claimProviderDispatch = vi.fn()
      .mockResolvedValueOnce(baseClaim)
      .mockResolvedValueOnce({ ...baseClaim, mode: "read_only" as const });
    const repo = repository(claimProviderDispatch);
    const requestRefund = vi.fn(async () => {
      throw new RefundWriteRejectedError("REFUND_PROVIDER_REJECTED", 422);
    });
    const service = createRefundCommandService({
      repository: repo,
      provider: provider(requestRefund),
      storeId: "STO_test",
      now: () => new Date("2026-09-07T00:00:00.000Z"),
    });

    await expect(service.execute(baseClaim.refundId)).rejects.toThrow("REFUND_PROVIDER_REJECTED");
    await expect(service.execute(baseClaim.refundId)).resolves.toEqual({ outcome: "read_only" });

    expect(requestRefund).toHaveBeenCalledTimes(1);
    expect(repo.markProviderDispatchRejected).toHaveBeenCalledTimes(1);
    expect(repo.releaseProviderDispatchNotSent).not.toHaveBeenCalled();
    expect(repo.markProviderDispatchAmbiguous).not.toHaveBeenCalled();
  });

  it("marks an uncertain provider call ambiguous and never issues a second POST", async () => {
    const claimProviderDispatch = vi.fn()
      .mockResolvedValueOnce(baseClaim)
      .mockResolvedValueOnce({ ...baseClaim, mode: "read_only" as const });
    const repo = repository(claimProviderDispatch);
    const requestRefund = vi.fn(async () => { throw new Error("connection reset after write"); });
    const service = createRefundCommandService({
      repository: repo,
      provider: provider(requestRefund),
      storeId: "STO_test",
      now: () => new Date("2026-09-07T00:00:00.000Z"),
    });

    await expect(service.execute(baseClaim.refundId)).rejects.toThrow("REFUND_PROVIDER_WRITE_OUTCOME_UNKNOWN");
    await expect(service.execute(baseClaim.refundId)).resolves.toEqual({ outcome: "read_only" });

    expect(requestRefund).toHaveBeenCalledTimes(1);
    expect(repo.markProviderDispatchConfirmed).not.toHaveBeenCalled();
    expect(repo.releaseProviderDispatchNotSent).not.toHaveBeenCalled();
    expect(repo.markProviderDispatchRejected).not.toHaveBeenCalled();
    expect(repo.markProviderDispatchAmbiguous).toHaveBeenCalledTimes(1);
  });
});
