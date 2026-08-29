import { afterEach, describe, expect, it, vi } from "vitest";
import { createOutboxDispatcher, type ClaimedOutboxItem } from "./outbox-dispatcher";

function item(id: string): ClaimedOutboxItem {
  return {
    id,
    inboxId: `inbox-${id}`,
    orderId: null,
    topic: "grant_entitlement",
    leaseToken: `lease-${id}`,
    attemptCount: 1,
  };
}

describe("OutboxDispatcher reconcile deadline", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not claim a batch after the absolute deadline", async () => {
    const dispatcher = createOutboxDispatcher({ sql: {} as any, repository: {} as any });
    const claim = vi.spyOn(dispatcher, "claimBatch").mockResolvedValue([item("1")]);
    vi.spyOn(Date, "now").mockReturnValue(100);

    const result = await dispatcher.dispatchAllPending({
      batchSize: 20,
      maxBatches: 3,
      deadlineAt: 100,
    });

    expect(claim).not.toHaveBeenCalled();
    expect(result).toEqual({ processedCount: 0, results: [] });
  });

  it("stops between outbox items when the deadline becomes exhausted", async () => {
    const dispatcher = createOutboxDispatcher({ sql: {} as any, repository: {} as any });
    const first = item("1");
    const second = item("2");
    vi.spyOn(dispatcher, "claimBatch").mockResolvedValue([first, second]);
    const dispatch = vi.spyOn(dispatcher, "dispatchItem").mockImplementation(async (claimed) => ({
      outboxId: claimed.id,
      inboxId: claimed.inboxId,
      outcome: "processed",
    }));

    const clock = vi.spyOn(Date, "now");
    clock
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValue(100);

    const result = await dispatcher.dispatchAllPending({
      batchSize: 20,
      maxBatches: 3,
      deadlineAt: 50,
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(first);
    expect(result.processedCount).toBe(1);
  });
});
