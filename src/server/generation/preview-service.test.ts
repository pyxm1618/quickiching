import { describe, expect, it } from "vitest";
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
