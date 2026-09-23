import { describe, expect, it, vi } from "vitest";
import { hashGenerationSnapshot } from "./boundary";
import { InMemoryPreviewGenerationRepository } from "./memory-repository";
import {
  PreviewGenerationService,
  type PreviewProvider,
  type OutputReviewer,
} from "./preview-service";

const facts = {
  method: "three_coin" as const,
  algorithmVersion: "three-coin-v1",
  classicMappingVersion: "king-wen-v1",
  lineValuesBottomUp: [7, 9, 8, 7, 6, 7] as [7, 9, 8, 7, 6, 7],
  primaryHexagramNumber: 1,
  movingLinePositions: [2, 5],
  relatingHexagramNumber: 44,
  readingVariant: "multiple_moving" as const,
};

const output = {
  schemaVersion: "commercial-preview-v1" as const,
  relevanceStatement: "The question and the pattern share a surface tension.",
  surfaceThemes: ["competing priorities"],
  boundary: "This is perspective, not a prediction or instruction.",
  disclaimer: "Use this as reflection rather than professional advice.",
};

function fixture(options: {
  provider?: Partial<PreviewProvider>;
  reviewer?: Partial<OutputReviewer>;
  persistFailure?: boolean;
  timeoutMs?: number;
  maxOutputTokens?: number;
} = {}) {
  const repository = new InMemoryPreviewGenerationRepository({
    castingId: "casting-1",
    userId: "user-1",
    lifecycle: "revealed",
    riskStatus: "allowed",
    riskRuleVersion: "risk-v2",
    generationEpoch: 3,
    question: "What should I understand about this career transition?",
    scene: "career",
    interpretationGoal: "what_do_i_need_to_see_clearly",
    facts,
    resultHmac: "result-hmac",
    resultHmacKeyVersion: "v1",
    resultIntegrityValid: true,
    persistFailure: options.persistFailure,
  });
  let providerCalls = 0;
  const provider: PreviewProvider = {
    provider: "fake",
    model: "fake-preview",
    async generatePreview(input) {
      providerCalls++;
      if (options.provider?.generatePreview) return options.provider.generatePreview(input, new AbortController().signal);
      return { output, deterministicFacts: input.facts, requestId: "fake-request-1" };
    },
    async generateReading() {
      throw new Error("DEEP_READING_NOT_OPEN");
    },
  };
  const reviewer: OutputReviewer = {
    reviewerModel: "fake-reviewer",
    async review(input) {
      if (options.reviewer?.review) return options.reviewer.review(input, new AbortController().signal);
      return { status: "pass", reasonCodes: [], schemaValid: true, safetyPass: true, factConsistencyPass: true };
    },
  };
  const service = new PreviewGenerationService({
    repository,
    provider,
    reviewer,
    timeoutMs: options.timeoutMs ?? 100,
    maxOutputTokens: options.maxOutputTokens,
    now: () => new Date("2026-08-23T00:00:00.000Z"),
  });
  return { service, repository, getProviderCalls: () => providerCalls };
}

describe("Auth-only Preview generation service", () => {
  it("rejects a wrong owner as a non-enumerating not-found", async () => {
    const { service } = fixture();
    await expect(service.generate({
      castingId: "casting-1",
      userId: "other-user",
      idempotencyKey: "request-1",
    })).rejects.toThrow("CASTING_NOT_FOUND");
  });

  it("rechecks reveal and risk state before creating a job", async () => {
    const unrevealed = fixture();
    unrevealed.repository.setContext({ lifecycle: "awaiting_reveal" });
    await expect(unrevealed.service.generate({ castingId: "casting-1", userId: "user-1", idempotencyKey: "request-2" }))
      .rejects.toThrow("PREVIEW_NOT_REVEALED");

    const blocked = fixture();
    blocked.repository.setContext({ riskStatus: "professional_decision_blocked" });
    await expect(blocked.service.generate({ castingId: "casting-1", userId: "user-1", idempotencyKey: "request-3" }))
      .rejects.toThrow("RISK_BLOCKED");
  });

  it("rejects an invalid result HMAC before provider execution", async () => {
    const { service, getProviderCalls } = fixture();
    (service.repository as InMemoryPreviewGenerationRepository).setContext({ resultIntegrityValid: false });
    await expect(service.generate({ castingId: "casting-1", userId: "user-1", idempotencyKey: "request-4" }))
      .rejects.toThrow("RESULT_INTEGRITY_INVALID");
    expect(getProviderCalls()).toBe(0);
  });

  it("persists a successful result before returning and never touches entitlements", async () => {
    const { service, repository } = fixture();
    const result = await service.generate({ castingId: "casting-1", userId: "user-1", idempotencyKey: "request-5" });

    expect(result.status).toBe("completed");
    expect(result.result?.output).toEqual(output);
    expect((await repository.getPreview("casting-1"))?.output).toEqual(output);
    expect(repository.entitlementTouched).toBe(false);
  });

  it("reuses a completed Preview even when the retry supplies a new idempotency key", async () => {
    const { service, repository, getProviderCalls } = fixture();

    const first = await service.generate({
      castingId: "casting-1",
      userId: "user-1",
      idempotencyKey: "completed-request-1",
    });
    const second = await service.generate({
      castingId: "casting-1",
      userId: "user-1",
      idempotencyKey: "completed-request-2",
    });

    expect(second).toMatchObject({ status: "completed", jobId: first.jobId, result: { output } });
    expect(getProviderCalls()).toBe(1);
    expect(repository.listJobs()).toHaveLength(1);
    expect(repository.listJobs()[0]?.status).toBe("completed");
  });

  it("invalidates a completed Preview when the epoch or input snapshot changes", async () => {
    const { service, repository, getProviderCalls } = fixture();
    const first = await service.generate({
      castingId: "casting-1",
      userId: "user-1",
      idempotencyKey: "completed-before-change",
    });

    repository.setContext({
      generationEpoch: 4,
      question: "What changed in this career transition?",
    });
    const second = await service.generate({
      castingId: "casting-1",
      userId: "user-1",
      idempotencyKey: "completed-after-change",
    });

    expect(second.status).toBe("completed");
    expect(second.jobId).not.toBe(first.jobId);
    expect((await repository.getPreview("casting-1"))?.jobId).toBe(second.jobId);
    expect(getProviderCalls()).toBe(2);
    expect(repository.listJobs().map((job) => job.status)).toEqual(["failed", "completed"]);
  });

  it("does not return a completed Preview after the current input snapshot changes", async () => {
    const { service, repository } = fixture();
    await service.generate({
      castingId: "casting-1",
      userId: "user-1",
      idempotencyKey: "status-before-change",
    });

    repository.setContext({
      generationEpoch: 4,
      question: "What changed after I reconsidered this transition?",
      scene: "relationships",
      interpretationGoal: "what_should_i_pay_attention_to_next",
    });

    await expect(service.getStatus({ castingId: "casting-1", userId: "user-1" }))
      .resolves.toEqual({ status: "not_started", jobId: null });
  });

  it("rejects an active job whose epoch or snapshot no longer matches", async () => {
    const { service, repository, getProviderCalls } = fixture();
    await repository.createOrReuseJob({
      castingId: "casting-1",
      userId: "user-1",
      kind: "preview",
      generationEpoch: 3,
      idempotencyKey: "active-before-change",
      inputSnapshotHash: hashGenerationSnapshot({
        castingId: "casting-1",
        userId: "user-1",
        generationEpoch: 3,
        question: "What should I understand about this career transition?",
        scene: "career",
        interpretationGoal: "what_do_i_need_to_see_clearly",
        facts,
      }),
      now: new Date("2026-08-23T00:00:00.000Z"),
    });
    repository.setContext({ generationEpoch: 4, question: "What changed?" });

    await expect(service.generate({
      castingId: "casting-1",
      userId: "user-1",
      idempotencyKey: "active-after-change",
    })).rejects.toThrow("GENERATION_IDEMPOTENCY_CONFLICT");
    expect(getProviderCalls()).toBe(0);
  });

  it("claims a queued job left behind before its first process claim", async () => {
    const { service, repository, getProviderCalls } = fixture();
    await repository.createOrReuseJob({
      castingId: "casting-1",
      userId: "user-1",
      kind: "preview",
      generationEpoch: 3,
      idempotencyKey: "orphaned-queued-job",
      inputSnapshotHash: hashGenerationSnapshot({
        castingId: "casting-1",
        userId: "user-1",
        generationEpoch: 3,
        question: "What should I understand about this career transition?",
        scene: "career",
        interpretationGoal: "what_do_i_need_to_see_clearly",
        facts,
      }),
      now: new Date("2026-08-23T00:00:00.000Z"),
    });

    const result = await service.generate({
      castingId: "casting-1",
      userId: "user-1",
      idempotencyKey: "retry-after-process-exit",
    });

    expect(result.status).toBe("completed");
    expect(getProviderCalls()).toBe(1);
    expect(repository.listJobs()).toHaveLength(1);
    expect(repository.listJobs()[0]?.status).toBe("completed");
  });

  it("deduplicates concurrent requests and active jobs at the persistence boundary", async () => {
    let releaseProvider!: () => void;
    const providerStarted = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    const first = fixture({
      provider: {
        async generatePreview(input) {
          await providerStarted;
          return { output, deterministicFacts: input.facts };
        },
      },
    });
    const p1 = first.service.generate({ castingId: "casting-1", userId: "user-1", idempotencyKey: "same-request" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const p2 = first.service.generate({ castingId: "casting-1", userId: "user-1", idempotencyKey: "same-request" });
    expect(first.repository.listJobs()).toHaveLength(1);
    expect((await p2).jobId).toBe(first.repository.listJobs()[0]?.id);
    releaseProvider();
    await expect(p1).resolves.toMatchObject({ status: "completed" });
    expect(first.getProviderCalls()).toBe(1);
  });

  it("does not persist malformed, unsafe, or review-rejected output", async () => {
    const malformed = fixture({ provider: { async generatePreview(input) {
      return { output: { nope: true }, deterministicFacts: input.facts };
    } } });
    await expect(malformed.service.generate({ castingId: "casting-1", userId: "user-1", idempotencyKey: "bad-schema" }))
      .rejects.toThrow("AI_SCHEMA_INVALID");
    await expect(malformed.repository.getPreview("casting-1")).resolves.toBeNull();

    const unsafe = fixture({ provider: { async generatePreview(input) {
      return {
        output: { ...output, relevanceStatement: "You will definitely win and should buy the stock now." },
        deterministicFacts: input.facts,
      };
    } } });
    await expect(unsafe.service.generate({ castingId: "casting-1", userId: "user-1", idempotencyKey: "bad-safety" }))
      .rejects.toThrow("OUTPUT_SAFETY_FAILURE");

    const reviewed = fixture({ reviewer: { async review() {
      return { status: "fail", reasonCodes: ["fact_consistency"], schemaValid: true, safetyPass: true, factConsistencyPass: false };
    } } });
    await expect(reviewed.service.generate({ castingId: "casting-1", userId: "user-1", idempotencyKey: "bad-review" }))
      .rejects.toThrow("OUTPUT_REVIEW_FAILED");
  });

  it("classifies timeout and late provider success without overwriting a terminal job", async () => {
    const deferred = fixture({ timeoutMs: 10, provider: { async generatePreview(input) {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return { output, deterministicFacts: input.facts };
    } } });
    await expect(deferred.service.generate({ castingId: "casting-1", userId: "user-1", idempotencyKey: "timeout" }))
      .rejects.toThrow("AI_GATEWAY_TIMEOUT");
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect(deferred.repository.getPreview("casting-1")).resolves.toBeNull();
    expect(deferred.repository.listJobs()[0]?.status).toBe("timed_out");
  });

  it("uses one end-to-end timeout budget for provider and reviewer", async () => {
    const bounded = fixture({
      timeoutMs: 30,
      provider: {
        async generatePreview(input) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return { output, deterministicFacts: input.facts };
        },
      },
      reviewer: {
        async review() {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return { status: "pass", reasonCodes: [], schemaValid: true, safetyPass: true, factConsistencyPass: true };
        },
      },
    });

    await expect(bounded.service.generate({
      castingId: "casting-1",
      userId: "user-1",
      idempotencyKey: "provider-and-review-budget",
    })).rejects.toThrow("AI_GATEWAY_TIMEOUT");
    await expect(bounded.repository.getPreview("casting-1")).resolves.toBeNull();
    expect(bounded.repository.listJobs()[0]?.status).toBe("timed_out");
  });

  it("keeps the end-to-end timeout independent from wall-clock changes", async () => {
    const wallClock = vi.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValue(0);
    const bounded = fixture({
      timeoutMs: 20,
      provider: {
        async generatePreview(input) {
          await new Promise((resolve) => setTimeout(resolve, 8));
          return { output, deterministicFacts: input.facts };
        },
      },
      reviewer: {
        async review() {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return { status: "pass", reasonCodes: [], schemaValid: true, safetyPass: true, factConsistencyPass: true };
        },
      },
    });

    await expect(bounded.service.generate({
      castingId: "casting-1",
      userId: "user-1",
      idempotencyKey: "monotonic-timeout",
    })).rejects.toThrow("AI_GATEWAY_TIMEOUT");
    wallClock.mockRestore();
  });

  it("rejects a result when the casting is deleted or its epoch changes while AI is running", async () => {
    const { service, repository } = fixture({
      provider: {
        async generatePreview(input) {
          repository.setContext({ lifecycle: "user_deleted", generationEpoch: 4, deletedAt: new Date() });
          return { output, deterministicFacts: input.facts };
        },
      },
    });

    await expect(service.generate({
      castingId: "casting-1",
      userId: "user-1",
      idempotencyKey: "stale-casting",
    })).rejects.toThrow("PERSISTENCE_FAILED");
    await expect(repository.getPreview("casting-1")).resolves.toBeNull();
    expect(repository.listJobs()[0]?.status).toBe("failed");
  });

  it("rejects a result when casting ownership changes while AI is running", async () => {
    const { service, repository } = fixture({
      provider: {
        async generatePreview(input) {
          repository.setContext({ userId: "new-owner" });
          return { output, deterministicFacts: input.facts };
        },
      },
    });

    await expect(service.generate({
      castingId: "casting-1",
      userId: "user-1",
      idempotencyKey: "owner-changed",
    })).rejects.toThrow("PERSISTENCE_FAILED");
    await expect(repository.getPreview("casting-1")).resolves.toBeNull();
  });

  it.each([
    ["scene", { scene: "relationships" as const }],
    ["interpretation goal", { interpretationGoal: "what_should_i_pay_attention_to_next" as const }],
  ])("rejects a result when %s changes while AI is running", async (_label, patch) => {
    const { service, repository } = fixture({
      provider: {
        async generatePreview(input) {
          repository.setContext(patch);
          return { output, deterministicFacts: input.facts };
        },
      },
    });

    await expect(service.generate({
      castingId: "casting-1",
      userId: "user-1",
      idempotencyKey: `stale-${_label}`,
    })).rejects.toThrow("PERSISTENCE_FAILED");
    await expect(repository.getPreview("casting-1")).resolves.toBeNull();
    expect(repository.listJobs()[0]?.status).toBe("failed");
  });

  it("enforces a durable-style retry budget across new idempotency keys", async () => {
    const { service, getProviderCalls } = fixture({
      provider: {
        async generatePreview() {
          throw new Error("upstream provider failure");
        },
      },
    });

    for (const idempotencyKey of ["failure-1", "failure-2", "failure-3"]) {
      await expect(service.generate({
        castingId: "casting-1",
        userId: "user-1",
        idempotencyKey,
      })).rejects.toThrow("provider_error");
    }
    await expect(service.generate({
      castingId: "casting-1",
      userId: "user-1",
      idempotencyKey: "failure-4",
    })).rejects.toThrow("PREVIEW_RETRY_BUDGET_EXCEEDED");
    expect(getProviderCalls()).toBe(3);
  });

  it("does not return success when persistence fails", async () => {
    const { service, repository } = fixture({ persistFailure: true });
    await expect(service.generate({ castingId: "casting-1", userId: "user-1", idempotencyKey: "persist-failure" }))
      .rejects.toThrow("PERSISTENCE_FAILED");
    await expect(repository.getPreview("casting-1")).resolves.toBeNull();
  });

  it("rejects provider output that exceeds the configured token ceiling", async () => {
    const limited = fixture({
      maxOutputTokens: 100,
      provider: {
        async generatePreview(input) {
          return { output, deterministicFacts: input.facts, tokenUsage: { output: 101, total: 101 } };
        },
      },
    });

    await expect(limited.service.generate({
      castingId: "casting-1",
      userId: "user-1",
      idempotencyKey: "cost-limit",
    })).rejects.toThrow("AI_COST_LIMIT");
    await expect(limited.repository.getPreview("casting-1")).resolves.toBeNull();
  });
});
