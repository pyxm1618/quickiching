import { afterEach, describe, expect, it, vi } from "vitest";
import { createReconcileService } from "./reconcile-service";

describe("ReconcileService deadline propagation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes one absolute deadline into outbox dispatch", async () => {
    const dispatchAllPending = vi.fn().mockResolvedValue({ processedCount: 0, results: [] });
    const sql = Object.assign(
      async () => [],
      { begin: async (callback: (transaction: any) => Promise<unknown>) => callback(sql as any) },
    ) as any;

    const clock = vi.spyOn(Date, "now");
    clock
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_000)
      .mockReturnValue(11_000);

    const service = createReconcileService({
      sql,
      outboxDispatcher: { dispatchAllPending } as any,
    });

    await service.runReconcile({ budgetMs: 10_000 });

    expect(dispatchAllPending).toHaveBeenCalledWith({
      batchSize: 20,
      maxBatches: 3,
      deadlineAt: 11_000,
    });
  });
});
