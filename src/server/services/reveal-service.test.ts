import { describe, expect, it } from "vitest";
import { ALGORITHM_VERSIONS } from "@/domain/casting/types";
import type { VersionedKeySet } from "@/server/config";
import { createMemoryRepositories } from "@/server/repositories/memory";
import { RevealService } from "./reveal-service";

const oldFingerprintKeys: VersionedKeySet = {
  writeVersion: "v1",
  read: [{ version: "v1", value: "old-question-fingerprint-key" }],
};
const rotatedFingerprintKeys: VersionedKeySet = {
  writeVersion: "v2",
  read: [
    { version: "v2", value: "new-question-fingerprint-key" },
    { version: "v1", value: "old-question-fingerprint-key" },
  ],
};
const sessionKeys: VersionedKeySet = {
  writeVersion: "v1",
  read: [{ version: "v1", value: "session-signing-key" }],
};

function createAwaitingReveal(
  repositories: ReturnType<typeof createMemoryRepositories>,
  owner: { userId: string | null; anonHash: string | null },
  question = "What should I understand about this career transition?",
): string {
  const casting = repositories.castingRepository.createCastingSession({
    method: "three_coin",
    scene: "career",
    interpretationGoal: "what_do_i_need_to_see_clearly",
    userId: owner.userId,
    anonHash: owner.anonHash,
    algorithmVersion: ALGORITHM_VERSIONS.three_coin,
  });
  repositories.castingRepository.recordRiskCheck({
    castingSessionId: casting.id,
    ruleVersion: "risk-v1",
    matchedRuleCodes: [],
    reasonCode: "allowed",
    status: "allowed",
  });
  repositories.castingRepository.addQuestionVersion({
    castingSessionId: casting.id,
    context: question,
    versionNumber: 1,
    reason: "initial",
  });
  for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
    repositories.castingRepository.saveStep({
      castingSessionId: casting.id,
      stepKind: "coin",
      lineIndex,
      changeIndex: null,
      rawRecord: { coinFaces: ["yang", "yang", "yin"] },
      lineValue: lineIndex % 2 === 0 ? 7 : 8,
    });
  }
  repositories.castingRepository.saveCastResult({
    castingSessionId: casting.id,
    lineValues: [7, 8, 7, 8, 7, 8],
    methodCalculation: { kind: "three-coin" },
  });
  return casting.id;
}

function fixture(questionFingerprintKeys = oldFingerprintKeys) {
  const repositories = createMemoryRepositories();
  const current = { value: new Date("2026-07-30T00:00:00.000Z") };
  let tokenCounter = 0;
  const service = new RevealService({
    castingRepository: repositories.castingRepository,
    loginIntentRepository: repositories.loginIntentRepository,
    revealRepository: repositories.revealRepository,
    clock: { now: () => new Date(current.value) },
    tokenSource: { randomToken: () => `nonce-${++tokenCounter}` },
    sessionSigningKeys: sessionKeys,
    questionFingerprintKeys,
  });
  return { repositories, current, service };
}

describe("RevealService Login Intent", () => {
  it("starts an intent only for the anonymous owner of an awaiting-reveal casting", () => {
    const { repositories, service } = fixture();
    const castingId = createAwaitingReveal(repositories, { userId: null, anonHash: "browser-a" });

    expect(() => service.startLoginIntent({
      castingId,
      anonymousSessionHash: "browser-b",
      allowedCallbackPath: `/result/${castingId}`,
    })).toThrow("CASTING_NOT_FOUND");

    const intent = service.startLoginIntent({
      castingId,
      anonymousSessionHash: "browser-a",
      allowedCallbackPath: `/result/${castingId}`,
    });
    expect(intent.intentId).toMatch(/^lint_[a-f0-9]{24}$/);
    expect(intent.nonce).toBe("nonce-1");
    expect(intent.allowedCallbackPath).toBe(`/result/${castingId}`);
  });

  it("reveals atomically to the authenticated user and withholds result access from the anonymous browser", () => {
    const { repositories, service } = fixture();
    const user = repositories.identityRepository.createUser("owner@example.com");
    const castingId = createAwaitingReveal(repositories, { userId: null, anonHash: "browser-a" });
    const intent = service.startLoginIntent({
      castingId,
      anonymousSessionHash: "browser-a",
      allowedCallbackPath: `/result/${castingId}`,
    });

    const outcome = service.consumeLoginIntentAndReveal({
      intentId: intent.intentId,
      nonce: intent.nonce,
      authenticatedUserId: user.id,
      callbackPath: intent.allowedCallbackPath,
    });

    expect(outcome).toEqual({
      revealed: true,
      duplicate: false,
      castingId,
    });
    expect(repositories.castingRepository.canReadRevealedResult(castingId, user.id)).toBe(true);
    expect(repositories.castingRepository.ownsCasting(castingId, null, "browser-a")).toBe(false);
  });

  it("rejects a replayed intent even when the casting was revealed successfully", () => {
    const { repositories, service } = fixture();
    const user = repositories.identityRepository.createUser("owner@example.com");
    const castingId = createAwaitingReveal(repositories, { userId: null, anonHash: "browser-a" });
    const intent = service.startLoginIntent({
      castingId,
      anonymousSessionHash: "browser-a",
      allowedCallbackPath: `/result/${castingId}`,
    });
    service.consumeLoginIntentAndReveal({
      intentId: intent.intentId,
      nonce: intent.nonce,
      authenticatedUserId: user.id,
      callbackPath: intent.allowedCallbackPath,
    });

    expect(() => service.consumeLoginIntentAndReveal({
      intentId: intent.intentId,
      nonce: intent.nonce,
      authenticatedUserId: user.id,
      callbackPath: intent.allowedCallbackPath,
    })).toThrow("LOGIN_INTENT_CONSUMED");
  });

  it("rejects expired, wrong-nonce, and callback-mismatched intents", () => {
    const { repositories, current, service } = fixture();
    const user = repositories.identityRepository.createUser("owner@example.com");

    const wrongNonceCasting = createAwaitingReveal(repositories, { userId: null, anonHash: "browser-a" });
    const wrongNonceIntent = service.startLoginIntent({
      castingId: wrongNonceCasting,
      anonymousSessionHash: "browser-a",
      allowedCallbackPath: `/result/${wrongNonceCasting}`,
    });
    expect(() => service.consumeLoginIntentAndReveal({
      intentId: wrongNonceIntent.intentId,
      nonce: "wrong",
      authenticatedUserId: user.id,
      callbackPath: wrongNonceIntent.allowedCallbackPath,
    })).toThrow("LOGIN_INTENT_INVALID");

    const callbackCasting = createAwaitingReveal(repositories, { userId: null, anonHash: "browser-b" });
    const callbackIntent = service.startLoginIntent({
      castingId: callbackCasting,
      anonymousSessionHash: "browser-b",
      allowedCallbackPath: `/result/${callbackCasting}`,
    });
    expect(() => service.consumeLoginIntentAndReveal({
      intentId: callbackIntent.intentId,
      nonce: callbackIntent.nonce,
      authenticatedUserId: user.id,
      callbackPath: "/account",
    })).toThrow("LOGIN_INTENT_CALLBACK_INVALID");

    const expiredCasting = createAwaitingReveal(repositories, { userId: null, anonHash: "browser-c" });
    const expiredIntent = service.startLoginIntent({
      castingId: expiredCasting,
      anonymousSessionHash: "browser-c",
      allowedCallbackPath: `/result/${expiredCasting}`,
    });
    current.value = new Date(current.value.getTime() + 11 * 60 * 1000);
    expect(() => service.consumeLoginIntentAndReveal({
      intentId: expiredIntent.intentId,
      nonce: expiredIntent.nonce,
      authenticatedUserId: user.id,
      callbackPath: expiredIntent.allowedCallbackPath,
    })).toThrow("LOGIN_INTENT_EXPIRED");
  });

  it("serializes competing same-question reveals and returns only the winning casting id", () => {
    const { repositories, service } = fixture();
    const user = repositories.identityRepository.createUser("owner@example.com");
    const firstCastingId = createAwaitingReveal(repositories, { userId: null, anonHash: "browser-a" });
    const secondCastingId = createAwaitingReveal(repositories, { userId: null, anonHash: "browser-b" });
    const firstIntent = service.startLoginIntent({
      castingId: firstCastingId,
      anonymousSessionHash: "browser-a",
      allowedCallbackPath: `/result/${firstCastingId}`,
    });
    const secondIntent = service.startLoginIntent({
      castingId: secondCastingId,
      anonymousSessionHash: "browser-b",
      allowedCallbackPath: `/result/${secondCastingId}`,
    });

    expect(service.consumeLoginIntentAndReveal({
      intentId: firstIntent.intentId,
      nonce: firstIntent.nonce,
      authenticatedUserId: user.id,
      callbackPath: firstIntent.allowedCallbackPath,
    })).toEqual({ revealed: true, duplicate: false, castingId: firstCastingId });

    expect(service.consumeLoginIntentAndReveal({
      intentId: secondIntent.intentId,
      nonce: secondIntent.nonce,
      authenticatedUserId: user.id,
      callbackPath: secondIntent.allowedCallbackPath,
    })).toEqual({
      revealed: false,
      duplicate: true,
      castingId: firstCastingId,
    });
    expect(repositories.castingRepository.getCastingSession(secondCastingId)?.lifecycle)
      .toBe("discarded_duplicate");
  });

  it("dual-reads the old fingerprint during rotation while single-writing the configured version", () => {
    const shared = createMemoryRepositories();
    const current = { value: new Date("2026-07-30T00:00:00.000Z") };
    let tokenCounter = 0;
    const makeService = (keys: VersionedKeySet) => new RevealService({
      castingRepository: shared.castingRepository,
      loginIntentRepository: shared.loginIntentRepository,
      revealRepository: shared.revealRepository,
      clock: { now: () => new Date(current.value) },
      tokenSource: { randomToken: () => `rotation-nonce-${++tokenCounter}` },
      sessionSigningKeys: sessionKeys,
      questionFingerprintKeys: keys,
    });
    const user = shared.identityRepository.createUser("owner@example.com");
    const oldCasting = createAwaitingReveal(shared, { userId: null, anonHash: "browser-old" });
    const oldService = makeService(oldFingerprintKeys);
    const oldIntent = oldService.startLoginIntent({
      castingId: oldCasting,
      anonymousSessionHash: "browser-old",
      allowedCallbackPath: `/result/${oldCasting}`,
    });
    oldService.consumeLoginIntentAndReveal({
      intentId: oldIntent.intentId,
      nonce: oldIntent.nonce,
      authenticatedUserId: user.id,
      callbackPath: oldIntent.allowedCallbackPath,
    });

    const newCasting = createAwaitingReveal(shared, { userId: null, anonHash: "browser-new" });
    const rotatedService = makeService(rotatedFingerprintKeys);
    const newIntent = rotatedService.startLoginIntent({
      castingId: newCasting,
      anonymousSessionHash: "browser-new",
      allowedCallbackPath: `/result/${newCasting}`,
    });

    expect(rotatedService.consumeLoginIntentAndReveal({
      intentId: newIntent.intentId,
      nonce: newIntent.nonce,
      authenticatedUserId: user.id,
      callbackPath: newIntent.allowedCallbackPath,
    })).toEqual({ revealed: false, duplicate: true, castingId: oldCasting });
  });
});

describe("RevealService authenticated casting", () => {
  it("reveals an owned casting idempotently without a Login Intent", () => {
    const { repositories, service } = fixture();
    const user = repositories.identityRepository.createUser("owner@example.com");
    const castingId = createAwaitingReveal(repositories, { userId: user.id, anonHash: null });

    expect(service.revealOwnedCasting({ castingId, authenticatedUserId: user.id }))
      .toEqual({ revealed: true, duplicate: false, castingId });
    expect(service.revealOwnedCasting({ castingId, authenticatedUserId: user.id }))
      .toEqual({ revealed: true, duplicate: false, castingId });
  });
});
