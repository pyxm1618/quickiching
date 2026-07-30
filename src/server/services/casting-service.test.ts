import { describe, expect, it, vi } from "vitest";
import { createMemoryRepositories } from "@/server/repositories/memory";
import type { CastingRepository } from "@/server/repositories/casting-repository";
import type { CastingStep } from "@/server/repositories/models";
import type { LineValue } from "@/domain/casting/types";
import { CastingService } from "./casting-service";

type AtomicCoinInput = {
  castingSessionId: string;
  lineIndex: number;
  create: () => { rawRecord: unknown; lineValue: LineValue };
};

type AtomicCoinOutcome = { step: CastingStep; completed: boolean };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function serviceFixture(
  castingRepository?: CastingRepository,
  riskEvaluate = vi.fn(() => ({
    status: "allowed" as const,
    ruleVersion: "risk-v1",
    matchedRuleCodes: [] as string[],
    reasonCode: "none",
  })),
) {
  const repositories = createMemoryRepositories();
  const current = { value: new Date("2026-07-30T00:00:00.000Z") };
  const randomBit = vi.fn(() => true);
  const randomInt = vi.fn((maxExclusive: number) => Math.max(1, Math.floor(maxExclusive / 2)));
  const service = new CastingService({
    castingRepository: castingRepository ?? repositories.castingRepository,
    clock: { now: () => new Date(current.value) },
    randomSource: { randomBit, randomInt },
    riskService: { evaluate: riskEvaluate },
  });
  return { service, repositories, current, randomBit, randomInt, riskEvaluate };
}

const draftInput = {
  method: "three_coin" as const,
  scene: "career" as const,
  interpretationGoal: "what_do_i_need_to_see_clearly" as const,
  userId: null,
  anonHash: "anonymous-owner",
};

describe("CastingService draft lifecycle", () => {
  it("cancels an unstarted draft before creating its replacement", () => {
    const { service, repositories } = serviceFixture();
    const first = service.createDraft(draftInput);

    const replacement = service.createDraft(draftInput);

    expect(replacement.castingId).not.toBe(first.castingId);
    expect(repositories.castingRepository.getCastingSession(first.castingId)?.lifecycle).toBe("user_deleted");
    expect(repositories.castingRepository.getCastingSession(replacement.castingId)?.lifecycle).toBe("draft");
  });

  it("expires a timed-out in-progress casting before creating a new draft", () => {
    const { service, repositories, current } = serviceFixture();
    const first = service.createDraft(draftInput);
    repositories.castingRepository.recordRiskCheck({
      castingSessionId: first.castingId,
      ruleVersion: "risk-v1",
      matchedRuleCodes: [],
      reasonCode: "none",
      status: "allowed",
    });
    repositories.castingRepository.addQuestionVersion({
      castingSessionId: first.castingId,
      context: "A sufficiently detailed original question",
      versionNumber: 1,
      reason: "initial",
    });
    repositories.castingRepository.saveStep({
      castingSessionId: first.castingId,
      stepKind: "coin",
      lineIndex: 0,
      changeIndex: null,
      rawRecord: { coinFaces: ["yang", "yang", "yang"] },
      lineValue: 9,
    });
    const expiry = repositories.castingRepository.getCastingSession(first.castingId)?.castingExpiresAt;
    current.value = new Date(expiry!.getTime() + 1);

    const replacement = service.createDraft(draftInput);

    expect(repositories.castingRepository.getCastingSession(first.castingId)?.lifecycle).toBe("expired");
    expect(replacement.lifecycle).toBe("draft");
  });
});

describe("CastingService question immutability", () => {
  it("rejects a different question after the initial question is persisted", () => {
    const { service, repositories } = serviceFixture();
    const draft = service.createDraft(draftInput);
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");

    expect(() => service.submitQuestion(
      draft.castingId,
      "What should I understand about a completely different decision?",
    )).toThrow("QUESTION_IMMUTABLE");
    expect(repositories.castingRepository.getLatestQuestionContext(draft.castingId))
      .toBe("What should I understand about this career transition?");
  });

  it("returns the persisted risk decision on an identical question retry", () => {
    const riskEvaluate = vi.fn()
      .mockReturnValueOnce({
        status: "allowed" as const,
        ruleVersion: "risk-v1",
        matchedRuleCodes: [],
        reasonCode: "none",
      })
      .mockReturnValueOnce({
        status: "emergency_blocked" as const,
        ruleVersion: "risk-v2",
        matchedRuleCodes: ["changed-rule"],
        reasonCode: "emergency",
      });
    const { service } = serviceFixture(undefined, riskEvaluate);
    const draft = service.createDraft(draftInput);
    const question = "What should I understand about this career transition?";

    const first = service.submitQuestion(draft.castingId, question);
    const replay = service.submitQuestion(draft.castingId, question);

    expect(first).toEqual({ riskStatus: "allowed", reasonCode: "none", emergency: false });
    expect(replay).toEqual(first);
    expect(riskEvaluate).toHaveBeenCalledTimes(1);
  });
});

describe("CastingService step guards", () => {
  it("rejects a coin step when the persisted method is yarrow stalk", async () => {
    const { service } = serviceFixture();
    const draft = service.createDraft({ ...draftInput, method: "yarrow_stalk" });
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");

    await expect(service.recordCoinLine(draft.castingId, 0)).rejects.toThrow("CASTING_METHOD_MISMATCH");
  });

  it("rejects a coin line that skips the first missing line", async () => {
    const { service } = serviceFixture();
    const draft = service.createDraft(draftInput);
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");

    await expect(service.recordCoinLine(draft.castingId, 1)).rejects.toThrow("CASTING_STEP_OUT_OF_ORDER");
  });

  it("interleaves two coin requests but invokes one random factory and returns one winner", async () => {
    const repositories = createMemoryRepositories();
    const firstEntered = deferred();
    const releaseFirst = deferred();
    const outcomes: AtomicCoinOutcome[] = [];
    let entrants = 0;
    const recordCoinStep = async (input: AtomicCoinInput): Promise<AtomicCoinOutcome> => {
      entrants++;
      if (entrants === 1) {
        firstEntered.resolve();
        await releaseFirst.promise;
      }
      const atomic = (repositories.castingRepository as CastingRepository & {
        recordCoinStep(input: AtomicCoinInput): Promise<AtomicCoinOutcome>;
      }).recordCoinStep;
      const outcome = await atomic.call(repositories.castingRepository, input);
      outcomes.push(outcome);
      if (entrants === 2) releaseFirst.resolve();
      return outcome;
    };
    const interleavingRepository = new Proxy(repositories.castingRepository, {
      get(target, property) {
        if (property === "recordCoinStep") return recordCoinStep;
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const { service, randomBit } = serviceFixture(interleavingRepository);
    const draft = service.createDraft(draftInput);
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");

    const firstRequest = Promise.resolve(service.recordCoinLine(draft.castingId, 0));
    await Promise.resolve();
    expect(entrants).toBe(1);
    await firstEntered.promise;
    const secondRequest = Promise.resolve(service.recordCoinLine(draft.castingId, 0));
    const [first, replay] = await Promise.all([firstRequest, secondRequest]);

    expect(replay).toEqual(first);
    expect(randomBit).toHaveBeenCalledTimes(3);
    expect(repositories.castingRepository.getSteps(draft.castingId)).toHaveLength(1);
    expect(outcomes).toHaveLength(2);
    expect(outcomes[0].step.id).toBe(outcomes[1].step.id);
  });

  it("reconciles an injected sixth-step-only commit before returning completed", async () => {
    const { service, repositories } = serviceFixture();
    const draft = service.createDraft(draftInput);
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");
    for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
      repositories.castingRepository.saveStep({
        castingSessionId: draft.castingId,
        stepKind: "coin",
        lineIndex,
        changeIndex: null,
        rawRecord: { coinFaces: ["yang", "yang", "yang"] },
        lineValue: 9,
      });
    }
    expect(repositories.castingRepository.getCastResult(draft.castingId)).toBeUndefined();

    const replay = await service.recordCoinLine(draft.castingId, 5);

    expect(replay.completed).toBe(true);
    expect(repositories.castingRepository.getCastResult(draft.castingId)).toBeDefined();
    expect(repositories.castingRepository.getCastingSession(draft.castingId)?.lifecycle).toBe("awaiting_reveal");
  });

  it("expires an unfinished casting before a new step and does not consume randomness", async () => {
    const { service, repositories, current, randomBit } = serviceFixture();
    const draft = service.createDraft(draftInput);
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");
    await service.recordCoinLine(draft.castingId, 0);
    const expiry = repositories.castingRepository.getCastingSession(draft.castingId)?.castingExpiresAt;
    current.value = new Date(expiry!.getTime() + 1);

    await expect(service.recordCoinLine(draft.castingId, 1)).rejects.toThrow("CASTING_EXPIRED");
    expect(repositories.castingRepository.getCastingSession(draft.castingId)?.lifecycle).toBe("expired");
    expect(randomBit).toHaveBeenCalledTimes(3);
  });

  it("rejects an exact coin replay after the session is already expired", async () => {
    const { service, repositories } = serviceFixture();
    const draft = service.createDraft(draftInput);
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");
    await service.recordCoinLine(draft.castingId, 0);
    repositories.castingRepository.transitionCasting(draft.castingId, "expired");

    await expect(service.recordCoinLine(draft.castingId, 0)).rejects.toThrow("CASTING_EXPIRED");
  });

  it("expires an awaiting-reveal coin replay when its reveal clock elapsed", async () => {
    const { service, repositories, current } = serviceFixture();
    const draft = service.createDraft(draftInput);
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");
    for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
      await service.recordCoinLine(draft.castingId, lineIndex as 0 | 1 | 2 | 3 | 4 | 5);
    }
    const revealExpiry = repositories.castingRepository.getCastingSession(draft.castingId)?.revealExpiresAt;
    current.value = new Date(revealExpiry!.getTime() + 1);

    await expect(service.recordCoinLine(draft.castingId, 5)).rejects.toThrow("CASTING_EXPIRED");
    expect(repositories.castingRepository.getCastingSession(draft.castingId)?.lifecycle).toBe("expired");
  });

  it("rejects a yarrow change when the persisted method is three coin", () => {
    const { service } = serviceFixture();
    const draft = service.createDraft(draftInput);
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");

    expect(() => service.recordYarrowChange(draft.castingId, 0, 0)).toThrow("CASTING_METHOD_MISMATCH");
  });

  it("rejects a yarrow change that skips the global next coordinate", () => {
    const { service } = serviceFixture();
    const draft = service.createDraft({ ...draftInput, method: "yarrow_stalk" });
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");

    expect(() => service.recordYarrowChange(draft.castingId, 0, 1)).toThrow("CASTING_STEP_OUT_OF_ORDER");
  });

  it("returns the persisted yarrow change on replay without re-consuming randomness", () => {
    const { service, repositories, randomInt } = serviceFixture();
    const draft = service.createDraft({ ...draftInput, method: "yarrow_stalk" });
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");

    const first = service.recordYarrowChange(draft.castingId, 0, 0);
    const replay = service.recordYarrowChange(draft.castingId, 0, 0);

    expect(first).toEqual({ lineIndex: 0, changeIndex: 0, completed: false });
    expect(replay).toEqual(first);
    expect(randomInt).toHaveBeenCalledTimes(1);
    expect(repositories.castingRepository.getSteps(draft.castingId)).toHaveLength(1);
  });

  it("rejects an exact yarrow replay after the session is already expired", () => {
    const { service, repositories } = serviceFixture();
    const draft = service.createDraft({ ...draftInput, method: "yarrow_stalk" });
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");
    service.recordYarrowChange(draft.castingId, 0, 0);
    repositories.castingRepository.transitionCasting(draft.castingId, "expired");

    expect(() => service.recordYarrowChange(draft.castingId, 0, 0)).toThrow("CASTING_EXPIRED");
  });

  it("expires an awaiting-reveal yarrow replay when its reveal clock elapsed", () => {
    const { service, repositories, current } = serviceFixture();
    const draft = service.createDraft({ ...draftInput, method: "yarrow_stalk" });
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");
    for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
      for (let changeIndex = 0; changeIndex < 3; changeIndex++) {
        service.recordYarrowChange(
          draft.castingId,
          lineIndex as 0 | 1 | 2 | 3 | 4 | 5,
          changeIndex as 0 | 1 | 2,
        );
      }
    }
    service.completeYarrow(draft.castingId);
    const revealExpiry = repositories.castingRepository.getCastingSession(draft.castingId)?.revealExpiresAt;
    current.value = new Date(revealExpiry!.getTime() + 1);

    expect(() => service.recordYarrowChange(draft.castingId, 5, 2)).toThrow("CASTING_EXPIRED");
    expect(repositories.castingRepository.getCastingSession(draft.castingId)?.lifecycle).toBe("expired");
  });

  it("validates yarrow method before replaying an existing coin result", () => {
    const { service, repositories } = serviceFixture();
    const draft = service.createDraft(draftInput);
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");
    repositories.castingRepository.saveStep({
      castingSessionId: draft.castingId,
      stepKind: "coin",
      lineIndex: 0,
      changeIndex: null,
      rawRecord: { coinFaces: ["yang", "yang", "yang"] },
      lineValue: 9,
    });
    repositories.castingRepository.saveCastResult({
      castingSessionId: draft.castingId,
      lineValues: [9, 9, 9, 9, 9, 9],
      methodCalculation: { kind: "three-coin" },
    });

    expect(() => service.completeYarrow(draft.castingId)).toThrow("CASTING_METHOD_MISMATCH");
  });

  it("validates Mei Hua method before replaying an existing coin result", () => {
    const { service, repositories } = serviceFixture();
    const draft = service.createDraft(draftInput);
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");
    repositories.castingRepository.saveStep({
      castingSessionId: draft.castingId,
      stepKind: "coin",
      lineIndex: 0,
      changeIndex: null,
      rawRecord: { coinFaces: ["yang", "yang", "yang"] },
      lineValue: 9,
    });
    repositories.castingRepository.saveCastResult({
      castingSessionId: draft.castingId,
      lineValues: [9, 9, 9, 9, 9, 9],
      methodCalculation: { kind: "three-coin" },
    });

    expect(() => service.recordMeiHua(draft.castingId, "Asia/Shanghai"))
      .toThrow("CASTING_METHOD_MISMATCH");
  });
});

describe("CastingService anonymous result secrecy", () => {
  it("completes three-coin persistence with coordinate-only anonymous progress", async () => {
    const { service, repositories } = serviceFixture();
    const draft = service.createDraft(draftInput);
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");
    let transport = await service.recordCoinLine(draft.castingId, 0);
    for (let lineIndex = 1; lineIndex < 6; lineIndex++) {
      transport = await service.recordCoinLine(draft.castingId, lineIndex as 1 | 2 | 3 | 4 | 5);
    }

    expect(transport).toEqual({
      lineIndex: 5,
      completed: true,
    });
    expect(repositories.castingRepository.getCastResult(draft.castingId)).toBeDefined();
  });

  it("completes yarrow persistence but returns only progress", () => {
    const { service, repositories } = serviceFixture();
    const draft = service.createDraft({ ...draftInput, method: "yarrow_stalk" });
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");
    for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
      for (let changeIndex = 0; changeIndex < 3; changeIndex++) {
        service.recordYarrowChange(
          draft.castingId,
          lineIndex as 0 | 1 | 2 | 3 | 4 | 5,
          changeIndex as 0 | 1 | 2,
        );
      }
    }

    const transport = service.completeYarrow(draft.castingId);

    expect(transport).toEqual({ completed: true });
    expect(repositories.castingRepository.getCastResult(draft.castingId)).toBeDefined();
    expect(repositories.castingRepository.getCastingSession(draft.castingId)?.lifecycle).toBe("awaiting_reveal");
  });

  it("persists Mei Hua once but returns no anonymous hexagram fields", () => {
    const { service, repositories, current } = serviceFixture();
    const draft = service.createDraft({ ...draftInput, method: "mei_hua_current_time" });
    service.submitQuestion(draft.castingId, "What should I understand about this career transition?");

    const first = service.recordMeiHua(draft.castingId, "Asia/Shanghai");
    current.value = new Date("2026-07-30T01:00:00.000Z");
    const replay = service.recordMeiHua(draft.castingId, "Asia/Shanghai");

    expect(first).toEqual({ completed: true });
    expect(replay).toEqual(first);
    expect(repositories.castingRepository.getSteps(draft.castingId)).toHaveLength(1);
    expect(repositories.castingRepository.getCastResult(draft.castingId)).toBeDefined();
  });
});
