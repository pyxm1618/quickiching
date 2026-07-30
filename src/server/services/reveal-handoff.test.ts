import { describe, expect, it } from "vitest";
import { ALGORITHM_VERSIONS } from "@/domain/casting/types";
import type { VersionedKeySet } from "@/server/config";
import { createMemoryRepositories } from "@/server/repositories/memory";
import { RevealService } from "./reveal-service";

const sessionKeys: VersionedKeySet = {
  writeVersion: "v2",
  read: [
    { version: "v2", value: "new-session-signing-key" },
    { version: "v1", value: "old-session-signing-key" },
  ],
};

const fingerprintKeys: VersionedKeySet = {
  writeVersion: "v1",
  read: [{ version: "v1", value: "question-fingerprint-key" }],
};

function createAwaitingReveal(
  repositories: ReturnType<typeof createMemoryRepositories>,
  anonymousSessionHash: string,
): string {
  const casting = repositories.castingRepository.createCastingSession({
    method: "three_coin",
    scene: "career",
    interpretationGoal: "what_do_i_need_to_see_clearly",
    userId: null,
    anonHash: anonymousSessionHash,
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
    context: "What should I understand about this transition?",
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

function fixture() {
  const repositories = createMemoryRepositories();
  const current = { value: new Date("2026-07-30T00:00:00.000Z") };
  let tokenCounter = 0;
  const service = new RevealService({
    castingRepository: repositories.castingRepository,
    loginIntentRepository: repositories.loginIntentRepository,
    revealRepository: repositories.revealRepository,
    clock: { now: () => new Date(current.value) },
    tokenSource: {
      randomToken: () => `opaque-handoff-token-${++tokenCounter}-with-sufficient-source-entropy`,
    },
    sessionSigningKeys: sessionKeys,
    questionFingerprintKeys: fingerprintKeys,
  });
  return { repositories, current, service };
}

describe("RevealService cross-browser handoff", () => {
  it("reveals in a different browser using only the opaque handoff state and authenticated identity", () => {
    const { repositories, service } = fixture();
    const user = repositories.identityRepository.createUser("owner@example.com");
    const castingId = createAwaitingReveal(repositories, "origin-browser");

    const handoff = service.startLoginHandoff({
      castingId,
      anonymousSessionHash: "origin-browser",
      expectedEmail: "Owner@Example.com",
      allowedCallbackPath: `/result/${castingId}`,
    });

    expect(handoff).toMatchObject({
      allowedCallbackPath: `/result/${castingId}`,
    });
    expect(handoff.handoffState).not.toContain(castingId);
    expect(handoff.handoffState).not.toContain("owner@example.com");

    expect(service.consumeLoginHandoffAndReveal({
      handoffState: handoff.handoffState,
      authenticatedUserId: user.id,
      authenticatedEmail: "owner@example.com",
    })).toEqual({ revealed: true, duplicate: false, castingId });
  });

  it("rejects an authenticated email mismatch without consuming the valid handoff", () => {
    const { repositories, service } = fixture();
    const attacker = repositories.identityRepository.createUser("attacker@example.com");
    const owner = repositories.identityRepository.createUser("owner@example.com");
    const castingId = createAwaitingReveal(repositories, "origin-browser");
    const handoff = service.startLoginHandoff({
      castingId,
      anonymousSessionHash: "origin-browser",
      expectedEmail: owner.email,
      allowedCallbackPath: `/result/${castingId}`,
    });

    expect(() => service.consumeLoginHandoffAndReveal({
      handoffState: handoff.handoffState,
      authenticatedUserId: attacker.id,
      authenticatedEmail: attacker.email,
    })).toThrow("LOGIN_INTENT_EMAIL_MISMATCH");

    expect(service.consumeLoginHandoffAndReveal({
      handoffState: handoff.handoffState,
      authenticatedUserId: owner.id,
      authenticatedEmail: owner.email,
    })).toEqual({ revealed: true, duplicate: false, castingId });
  });

  it("rejects tampering, expiry, and replay", () => {
    const { repositories, current, service } = fixture();
    const user = repositories.identityRepository.createUser("owner@example.com");

    const tamperedCasting = createAwaitingReveal(repositories, "browser-a");
    const tampered = service.startLoginHandoff({
      castingId: tamperedCasting,
      anonymousSessionHash: "browser-a",
      expectedEmail: user.email,
      allowedCallbackPath: `/result/${tamperedCasting}`,
    });
    expect(() => service.consumeLoginHandoffAndReveal({
      handoffState: `${tampered.handoffState}x`,
      authenticatedUserId: user.id,
      authenticatedEmail: user.email,
    })).toThrow("LOGIN_INTENT_INVALID");

    const expiredCasting = createAwaitingReveal(repositories, "browser-b");
    const expired = service.startLoginHandoff({
      castingId: expiredCasting,
      anonymousSessionHash: "browser-b",
      expectedEmail: user.email,
      allowedCallbackPath: `/result/${expiredCasting}`,
    });
    current.value = new Date(current.value.getTime() + 11 * 60 * 1000);
    expect(() => service.consumeLoginHandoffAndReveal({
      handoffState: expired.handoffState,
      authenticatedUserId: user.id,
      authenticatedEmail: user.email,
    })).toThrow("LOGIN_INTENT_EXPIRED");

    current.value = new Date("2026-07-30T01:00:00.000Z");
    const replayCasting = createAwaitingReveal(repositories, "browser-c");
    const replay = service.startLoginHandoff({
      castingId: replayCasting,
      anonymousSessionHash: "browser-c",
      expectedEmail: user.email,
      allowedCallbackPath: `/result/${replayCasting}`,
    });
    service.consumeLoginHandoffAndReveal({
      handoffState: replay.handoffState,
      authenticatedUserId: user.id,
      authenticatedEmail: user.email,
    });
    expect(() => service.consumeLoginHandoffAndReveal({
      handoffState: replay.handoffState,
      authenticatedUserId: user.id,
      authenticatedEmail: user.email,
    })).toThrow("LOGIN_INTENT_CONSUMED");
  });
});
