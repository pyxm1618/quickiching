import { describe, expect, it } from "vitest";
import { DomainError } from "@/server/errors/domain-error";
import { repo } from "./repository";

describe("repository internal integrity failures", () => {
  it("keeps a missing reservation as an internal error instead of a public domain failure", () => {
    try {
      repo.completeReadingConsume("res_missing_internal_record", {});
      throw new Error("expected missing reservation to throw");
    } catch (error) {
      expect(error).not.toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("RESERVATION_NOT_FOUND");
    }
  });
});

describe("revealed result access", () => {
  it("does not expose a completed anonymous casting before it is revealed", () => {
    const casting = repo.createCastingSession({
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: null,
      anonHash: `anon-${crypto.randomUUID()}`,
      algorithmVersion: "three-coin-v1",
    });
    repo.saveStep({
      castingSessionId: casting.id,
      stepKind: "coin",
      lineIndex: 0,
      changeIndex: null,
      rawRecord: { coinFaces: ["heads", "heads", "heads"] },
      lineValue: 9,
    });
    repo.saveCastResult({
      castingSessionId: casting.id,
      lineValues: [7, 7, 7, 7, 7, 7],
      methodCalculation: {},
    });

    expect(repo.canReadRevealedResult(casting.id, null)).toBe(false);
  });

  it("allows a bound user to read only their revealed casting", () => {
    const owner = repo.createUser(`owner-${crypto.randomUUID()}@example.com`);
    const other = repo.createUser(`other-${crypto.randomUUID()}@example.com`);
    const casting = repo.createCastingSession({
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: owner.id,
      anonHash: null,
      algorithmVersion: "three-coin-v1",
    });
    repo.saveStep({
      castingSessionId: casting.id,
      stepKind: "coin",
      lineIndex: 0,
      changeIndex: null,
      rawRecord: { coinFaces: ["heads", "heads", "heads"] },
      lineValue: 9,
    });
    repo.saveCastResult({
      castingSessionId: casting.id,
      lineValues: [7, 7, 7, 7, 7, 7],
      methodCalculation: {},
    });
    repo.transitionCasting(casting.id, "revealed");

    expect(repo.canReadRevealedResult(casting.id, other.id)).toBe(false);
    expect(repo.canReadRevealedResult(casting.id, owner.id)).toBe(true);
  });
});

describe("repository terminal transitions", () => {
  it("reveals one winner and marks a concurrent same-question cast as a duplicate", () => {
    const user = repo.createUser(`reveal-${crypto.randomUUID()}@example.com`);
    const createReadyAnonymous = () => {
      const casting = repo.createCastingSession({
        method: "three_coin", scene: "career", interpretationGoal: "what_do_i_need_to_see_clearly",
        userId: null, anonHash: `anon-${crypto.randomUUID()}`, algorithmVersion: "three-coin-v1",
      });
      repo.saveStep({ castingSessionId: casting.id, stepKind: "coin", lineIndex: 0, changeIndex: null, rawRecord: {}, lineValue: 7 });
      repo.saveCastResult({ castingSessionId: casting.id, lineValues: [7, 7, 7, 7, 7, 7], methodCalculation: {} });
      return casting;
    };
    const first = createReadyAnonymous();
    const second = createReadyAnonymous();

    expect(repo.revealWithQuestionLock({ castingId: first.id, userId: user.id, fingerprint: "same", keyVersion: "v1", now: new Date() })).toMatchObject({ revealed: true, duplicate: false });
    expect(repo.revealWithQuestionLock({ castingId: second.id, userId: user.id, fingerprint: "same", keyVersion: "v1", now: new Date() })).toMatchObject({ revealed: false, duplicate: true, winningCastingId: first.id });
    expect(repo.getCastingSession(second.id)?.lifecycle).toBe("discarded_duplicate");
  });
  it("does not consume a reservation twice", () => {
    const user = repo.createUser(`credit-${crypto.randomUUID()}@example.com`);
    const casting = repo.createCastingSession({
      method: "three_coin", scene: "career", interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: user.id, anonHash: null, algorithmVersion: "three-coin-v1",
    });
    const reading = repo.getOrCreateReading(casting.id);
    repo.grantEntitlement({ userId: user.id, productId: "one", quantity: 1, amountUsd: 2.99 });
    const frozen = repo.freezeForReading(reading.id, user.id, new Date());
    if (!("reservationId" in frozen)) throw new Error("expected reservation");
    repo.completeReadingConsume(frozen.reservationId, { coreSummary: "done" });
    repo.completeReadingConsume(frozen.reservationId, { coreSummary: "done" });

    expect(repo.getBatches(user.id)[0]).toMatchObject({ quantityAvailable: 0, quantityReserved: 0, quantityConsumed: 1 });
  });

  it("does not release a reservation after it was consumed", () => {
    const user = repo.createUser(`release-${crypto.randomUUID()}@example.com`);
    const casting = repo.createCastingSession({
      method: "three_coin", scene: "career", interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: user.id, anonHash: null, algorithmVersion: "three-coin-v1",
    });
    const reading = repo.getOrCreateReading(casting.id);
    repo.grantEntitlement({ userId: user.id, productId: "one", quantity: 1, amountUsd: 2.99 });
    const frozen = repo.freezeForReading(reading.id, user.id, new Date());
    if (!("reservationId" in frozen)) throw new Error("expected reservation");
    repo.completeReadingConsume(frozen.reservationId, { coreSummary: "done" });
    repo.releaseReading(frozen.reservationId, false);

    expect(repo.getBatches(user.id)[0]).toMatchObject({ quantityAvailable: 0, quantityReserved: 0, quantityConsumed: 1 });
  });

  it("rejects quality reviews from someone other than the revealed casting owner", () => {
    const owner = repo.createUser(`review-owner-${crypto.randomUUID()}@example.com`);
    const other = repo.createUser(`review-other-${crypto.randomUUID()}@example.com`);
    const casting = repo.createCastingSession({
      method: "three_coin", scene: "career", interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: owner.id, anonHash: null, algorithmVersion: "three-coin-v1",
    });
    const reading = repo.getOrCreateReading(casting.id);

    expect(() => repo.createQualityReview({ readingId: reading.id, userId: other.id, reason: "wrong owner" })).toThrow("QUALITY_REVIEW_FORBIDDEN");
  });

  it("rejects deletion until a casting has been revealed", () => {
    const user = repo.createUser(`delete-${crypto.randomUUID()}@example.com`);
    const casting = repo.createCastingSession({
      method: "three_coin", scene: "career", interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: user.id, anonHash: null, algorithmVersion: "three-coin-v1",
    });

    expect(() => repo.requestCastingDeletion(casting.id)).toThrow("CASTING_NOT_DELETABLE");
  });

  it("lists deleted casts inside their recovery window and purges expired ones", () => {
    const user = repo.createUser(`recovery-${crypto.randomUUID()}@example.com`);
    const casting = repo.createCastingSession({
      method: "three_coin", scene: "career", interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: user.id, anonHash: null, algorithmVersion: "three-coin-v1",
    });
    repo.saveStep({ castingSessionId: casting.id, stepKind: "coin", lineIndex: 0, changeIndex: null, rawRecord: {}, lineValue: 7 });
    repo.saveCastResult({ castingSessionId: casting.id, lineValues: [7, 7, 7, 7, 7, 7], methodCalculation: {} });
    repo.transitionCasting(casting.id, "revealed");
    repo.requestCastingDeletion(casting.id);

    expect(repo.listRecoverableDeletedCasts(user.id, new Date())).toHaveLength(1);
    expect(repo.purgeDeletedCasts(new Date(Date.now() + 31 * 24 * 3600 * 1000))).toBeGreaterThanOrEqual(1);
    expect(repo.listRecoverableDeletedCasts(user.id, new Date())).toHaveLength(0);
  });
});
