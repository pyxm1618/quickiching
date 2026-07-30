import { describe, expect, it, vi } from "vitest";
import { GenerationJobService, type GenerationJobRepository } from "./generation-job-service";

function jobRepository(overrides: Partial<GenerationJobRepository> = {}): GenerationJobRepository {
  return {
    enqueue: vi.fn(async (input) => ({
      id: "job_1",
      jobType: input.jobType,
      castingId: input.castingId,
      readingId: input.readingId,
      reservationId: input.reservationId,
      status: "queued",
      generationEpoch: 0,
      snapshot: input.snapshot,
      timeoutAt: input.timeoutAt,
    })),
    claim: vi.fn(async () => ({
      id: "job_1",
      jobType: "deep_reading",
      castingId: "cas_1",
      readingId: "rdg_1",
      reservationId: "res_1",
      status: "running",
      generationEpoch: 1,
      snapshot: { kind: "reading" },
      timeoutAt: new Date("2026-07-30T00:05:00.000Z"),
    })),
    complete: vi.fn(async () => true),
    fail: vi.fn(async () => ({ terminal: true })),
    ...overrides,
  };
}

describe("GenerationJobService", () => {
  it("persists the immutable snapshot and outbox request before returning a job", async () => {
    const repository = jobRepository();
    const service = new GenerationJobService({
      repository,
      provider: { generateReading: vi.fn(), generatePreview: vi.fn() },
      entitlement: { consume: vi.fn(), release: vi.fn() },
      clock: { now: () => new Date("2026-07-30T00:00:00.000Z") },
    });

    const snapshot = { contextCiphertext: "encrypted", resultHmac: "v1.digest" };
    await service.enqueueReading({
      castingId: "cas_1",
      readingId: "rdg_1",
      reservationId: "res_1",
      snapshot,
    });

    expect(repository.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      jobType: "deep_reading",
      snapshot,
      timeoutAt: new Date("2026-07-30T00:05:00.000Z"),
      outboxTopic: "generation.requested",
    }));
  });

  it("consumes the reservation only after an epoch-matched durable completion", async () => {
    const repository = jobRepository();
    const consume = vi.fn();
    const service = new GenerationJobService({
      repository,
      provider: {
        generateReading: vi.fn(async () => ({ output: { report: true }, attempts: [] })),
        generatePreview: vi.fn(),
      },
      entitlement: { consume, release: vi.fn() },
      clock: { now: () => new Date("2026-07-30T00:01:00.000Z") },
    });

    await expect(service.execute("job_1")).resolves.toMatchObject({ completed: true, generationEpoch: 1 });
    expect(repository.complete).toHaveBeenCalledWith(expect.objectContaining({ generationEpoch: 1 }));
    expect(consume).toHaveBeenCalledWith("res_1");
  });

  it("does not consume an entitlement when a stale workflow loses the generation-epoch fence", async () => {
    const repository = jobRepository({ complete: vi.fn(async () => false) });
    const consume = vi.fn();
    const service = new GenerationJobService({
      repository,
      provider: {
        generateReading: vi.fn(async () => ({ output: { report: true }, attempts: [] })),
        generatePreview: vi.fn(),
      },
      entitlement: { consume, release: vi.fn() },
      clock: { now: () => new Date("2026-07-30T00:01:00.000Z") },
    });

    await expect(service.execute("job_1")).resolves.toEqual({ completed: false, generationEpoch: 1 });
    expect(consume).not.toHaveBeenCalled();
  });

  it("releases a reading reservation when retries are exhausted", async () => {
    const repository = jobRepository({ fail: vi.fn(async () => ({ terminal: true })) });
    const release = vi.fn();
    const service = new GenerationJobService({
      repository,
      provider: {
        generateReading: vi.fn(async () => { throw new Error("AI_PROVIDER_UNAVAILABLE"); }),
        generatePreview: vi.fn(),
      },
      entitlement: { consume: vi.fn(), release },
      clock: { now: () => new Date("2026-07-30T00:01:00.000Z") },
    });

    await expect(service.execute("job_1")).rejects.toThrow("AI_PROVIDER_UNAVAILABLE");
    expect(repository.fail).toHaveBeenCalledWith(expect.objectContaining({ generationEpoch: 1 }));
    expect(release).toHaveBeenCalledWith("res_1", false);
  });
});
