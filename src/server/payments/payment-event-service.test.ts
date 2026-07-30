import { describe, expect, it, vi } from "vitest";
import { PaymentEventService, type PaymentEventRepository } from "./payment-event-service";

function repositoryFixture(): PaymentEventRepository & {
  completed: ReturnType<typeof vi.fn>;
  refunded: ReturnType<typeof vi.fn>;
  disputed: ReturnType<typeof vi.fn>;
  released: ReturnType<typeof vi.fn>;
} {
  const seen = new Set<string>();
  const released = vi.fn(async (event) => { seen.delete(event.providerEventId); });
  return {
    claimEvent: vi.fn(async (event) => {
      if (seen.has(event.providerEventId)) return false;
      seen.add(event.providerEventId);
      return true;
    }),
    releaseEvent: released,
    completed: vi.fn(async () => undefined),
    refunded: vi.fn(async () => undefined),
    disputed: vi.fn(async () => undefined),
    released,
    applyCheckoutCompleted(event) { return this.completed(event); },
    applyRefund(event) { return this.refunded(event); },
    applyDispute(event) { return this.disputed(event); },
  };
}

describe("PaymentEventService", () => {
  it("grants a paid order once when Creem retries the same checkout event", async () => {
    const repository = repositoryFixture();
    const service = new PaymentEventService(repository);
    const event = {
      providerEventId: "evt_checkout",
      type: "checkout.completed" as const,
      orderId: "ord_1",
      providerCheckoutId: "ch_1",
      raw: {},
    };

    await expect(service.process(event)).resolves.toEqual({ processed: true });
    await expect(service.process(event)).resolves.toEqual({ processed: false });
    expect(repository.completed).toHaveBeenCalledOnce();
  });

  it.each([
    ["refund.created" as const, "refunded"],
    ["dispute.created" as const, "disputed"],
  ])("applies %s exactly once", async (type, method) => {
    const repository = repositoryFixture();
    const service = new PaymentEventService(repository);
    const event = {
      providerEventId: `evt_${method}`,
      type,
      orderId: "ord_1",
      providerCheckoutId: "ch_1",
      raw: {},
    };

    await service.process(event);
    await service.process(event);
    expect(repository[method as "refunded" | "disputed"]).toHaveBeenCalledOnce();
  });

  it("releases an unprocessed inbox claim so a provider retry can succeed", async () => {
    const repository = repositoryFixture();
    repository.completed
      .mockRejectedValueOnce(new Error("temporary database failure"))
      .mockResolvedValueOnce(undefined);
    const service = new PaymentEventService(repository);
    const event = {
      providerEventId: "evt_retryable",
      type: "checkout.completed" as const,
      orderId: "ord_1",
      providerCheckoutId: "ch_1",
      raw: {},
    };

    await expect(service.process(event)).rejects.toThrow("temporary database failure");
    expect(repository.released).toHaveBeenCalledOnce();
    await expect(service.process(event)).resolves.toEqual({ processed: true });
    expect(repository.completed).toHaveBeenCalledTimes(2);
  });
});
