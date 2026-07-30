import { describe, expect, it, vi } from "vitest";
import { RuntimeMaintenanceService } from "./runtime-maintenance";

describe("RuntimeMaintenanceService", () => {
  it("releases reservations only for terminal timed-out reading jobs", async () => {
    const repository = {
      cleanupCastingAndTokens: vi.fn(async () => ({ expiredCastings: 2, deletedTokens: 3, deletedLocks: 1 })),
      recoverTimedOutJobs: vi.fn(async () => [
        { jobId: "job_retry", terminal: false, reservationId: "res_retry" },
        { jobId: "job_terminal", terminal: true, reservationId: "res_terminal" },
        { jobId: "job_preview", terminal: true, reservationId: null },
      ]),
      purgeDeletedCasts: vi.fn(async () => 4),
    };
    const release = vi.fn();
    const service = new RuntimeMaintenanceService({
      repository,
      entitlement: { release },
      clock: { now: () => new Date("2026-07-30T00:00:00.000Z") },
    });

    await expect(service.run()).resolves.toEqual({
      expiredCastings: 2,
      deletedTokens: 3,
      deletedLocks: 1,
      recoveredJobs: 1,
      terminalJobs: 2,
      purgedCasts: 4,
      releasedReservations: 1,
    });
    expect(release).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledWith("res_terminal", false);
  });
});
