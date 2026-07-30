import { describe, expect, it } from "vitest";
import { DomainError } from "@/server/errors/domain-error";
import { repo } from "@/server/repository";

function createCasting(owner: { userId: string | null; anonHash: string | null }) {
  return repo.createCastingSession({
    method: "three_coin",
    scene: "career",
    interpretationGoal: "what_do_i_need_to_see_clearly",
    ...owner,
    algorithmVersion: "three-coin-v1",
  });
}

describe("memory casting repository characterization", () => {
  it("creates, loads, and expires identity sessions", () => {
    const email = `identity-${crypto.randomUUID()}@example.com`;
    const user = repo.createUser(email);
    const session = repo.createSession(user.id);

    expect(repo.getUserByEmail(email)).toEqual(user);
    expect(repo.getUser(user.id)).toEqual(user);
    expect(repo.getSession(session.id)).toEqual(session);
    expect(session.expiresAt.getTime()).toBeGreaterThan(session.createdAt.getTime());
  });

  it("keeps at most one active casting per owner", () => {
    const anonHash = `anon-${crypto.randomUUID()}`;
    const first = createCasting({ userId: null, anonHash });

    expect(repo.hasActiveCast(anonHash, false)).toBe(true);
    expect(() => createCasting({ userId: null, anonHash })).toThrow("CASTING_ALREADY_IN_PROGRESS");
    expect(repo.getCastingSession(first.id)).toEqual(first);
  });

  it("persists idempotent ordered steps and an idempotent cast result", () => {
    const casting = createCasting({ userId: null, anonHash: `anon-${crypto.randomUUID()}` });
    const first = repo.saveStep({
      castingSessionId: casting.id,
      stepKind: "coin",
      lineIndex: 1,
      changeIndex: null,
      rawRecord: { faces: ["heads", "tails", "heads"] },
      lineValue: 8,
    });
    const replay = repo.saveStep({
      castingSessionId: casting.id,
      stepKind: "coin",
      lineIndex: 1,
      changeIndex: null,
      rawRecord: { faces: ["different"] },
      lineValue: 9,
    });
    repo.saveStep({
      castingSessionId: casting.id,
      stepKind: "coin",
      lineIndex: 0,
      changeIndex: null,
      rawRecord: {},
      lineValue: 7,
    });

    expect(replay).toEqual(first);
    expect(repo.getSteps(casting.id).map((step) => step.lineIndex)).toEqual([0, 1]);
    expect(repo.getCastingSession(casting.id)).toMatchObject({ lifecycle: "casting" });

    const saved = repo.saveCastResult({
      castingSessionId: casting.id,
      lineValues: [7, 8, 7, 8, 7, 8],
      methodCalculation: { source: "first" },
    });
    const replayed = repo.saveCastResult({
      castingSessionId: casting.id,
      lineValues: [9, 9, 9, 9, 9, 9],
      methodCalculation: { source: "replay" },
    });

    expect(replayed).toEqual(saved);
    expect(repo.getCastResult(casting.id)).toEqual(saved);
    expect(repo.getCastingSession(casting.id)?.lifecycle).toBe("awaiting_reveal");
  });

  it("appends encrypted question versions and reads the highest version", () => {
    const casting = createCasting({ userId: null, anonHash: `anon-${crypto.randomUUID()}` });
    repo.addQuestionVersion({ castingSessionId: casting.id, context: "first context", versionNumber: 1, reason: "initial" });
    const latest = repo.addQuestionVersion({ castingSessionId: casting.id, context: "clarified context", versionNumber: 2, reason: "clarification" });

    expect(repo.getLatestQuestionContext(casting.id)).toBe("clarified context");
    expect(repo.getCastingSession(casting.id)?.currentQuestionVersionId).toBe(latest.id);
  });

  it("records risk and reveals only the winning user-bound casting", () => {
    const user = repo.createUser(`reveal-${crypto.randomUUID()}@example.com`);
    const casting = createCasting({ userId: null, anonHash: `anon-${crypto.randomUUID()}` });
    repo.recordRiskCheck({
      castingSessionId: casting.id,
      ruleVersion: "risk-v1",
      matchedRuleCodes: [],
      reasonCode: "allowed",
      status: "allowed",
    });
    repo.saveStep({ castingSessionId: casting.id, stepKind: "coin", lineIndex: 0, changeIndex: null, rawRecord: {}, lineValue: 7 });
    repo.saveCastResult({ castingSessionId: casting.id, lineValues: [7, 7, 7, 7, 7, 7], methodCalculation: {} });

    const reveal = repo.revealWithQuestionLock({
      castingId: casting.id,
      userId: user.id,
      fingerprint: `fingerprint-${crypto.randomUUID()}`,
      keyVersion: "v1",
      now: new Date(),
    });

    expect(reveal).toEqual({ revealed: true, duplicate: false });
    expect(repo.canReadRevealedResult(casting.id, user.id)).toBe(true);
    expect(repo.canReadRevealedResult(casting.id, null)).toBe(false);
    expect(repo.getCastingSession(casting.id)).toMatchObject({ userId: user.id, anonymousSessionHash: null, riskStatus: "allowed" });
  });
});

describe("memory casting repository audited defects", () => {
  it("denies ownership when both supplied owner identifiers are null", () => {
    const user = repo.createUser(`null-owner-${crypto.randomUUID()}@example.com`);
    const casting = createCasting({ userId: user.id, anonHash: null });

    expect(repo.ownsCasting(casting.id, null, null)).toBe(false);
  });

  it("fails before creating child records for a missing casting", () => {
    expect(() => repo.addQuestionVersion({
      castingSessionId: `missing-${crypto.randomUUID()}`,
      context: "orphan context",
      versionNumber: 1,
      reason: "initial",
    })).toThrowError(DomainError);
  });

  it("does not let callers mutate an appended question version", () => {
    const casting = createCasting({ userId: null, anonHash: `anon-${crypto.randomUUID()}` });
    const first = repo.addQuestionVersion({ castingSessionId: casting.id, context: "original", versionNumber: 1, reason: "initial" });
    try {
      (first as { versionNumber: number }).versionNumber = 99;
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
    }
    repo.addQuestionVersion({ castingSessionId: casting.id, context: "clarified", versionNumber: 2, reason: "clarification" });

    expect(repo.getLatestQuestionContext(casting.id)).toBe("clarified");
  });
});
