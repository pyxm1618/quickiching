import { describe, expect, it } from "vitest";
import { repo } from "@/server/repository";
import { createMemoryRepositories, MemoryStore } from "./index";

function createRevealedCasting() {
  const user = repo.createUser(`privacy-${crypto.randomUUID()}@example.com`);
  const casting = repo.createCastingSession({
    method: "three_coin",
    scene: "career",
    interpretationGoal: "what_do_i_need_to_see_clearly",
    userId: user.id,
    anonHash: null,
    algorithmVersion: "three-coin-v1",
  });
  repo.addQuestionVersion({ castingSessionId: casting.id, context: "private context", versionNumber: 1, reason: "initial" });
  repo.saveStep({ castingSessionId: casting.id, stepKind: "coin", lineIndex: 0, changeIndex: null, rawRecord: {}, lineValue: 7 });
  repo.saveCastResult({ castingSessionId: casting.id, lineValues: [7, 7, 7, 7, 7, 7], methodCalculation: {} });
  repo.transitionCasting(casting.id, "revealed");
  return { user, casting };
}

describe("memory privacy repository characterization", () => {
  it("lists visible history and exposes deleted casts only during recovery", () => {
    const { user, casting } = createRevealedCasting();

    expect(repo.listCastsForUser(user.id).map((item) => item.id)).toContain(casting.id);
    repo.requestCastingDeletion(casting.id);
    expect(repo.listCastsForUser(user.id).map((item) => item.id)).not.toContain(casting.id);
    expect(repo.listRecoverableDeletedCasts(user.id, new Date()).map((item) => item.id)).toContain(casting.id);
  });
});

describe("memory privacy repository audited defects", () => {
  it("purges every cast-owned record while retaining identity and financial records", () => {
    const store = new MemoryStore();
    const { repo: isolated, loginIntentRepository } = createMemoryRepositories(store);
    const user = isolated.createUser(`complete-purge-${crypto.randomUUID()}@example.com`);
    isolated.createSession(user.id);
    const casting = isolated.createCastingSession({
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: user.id,
      anonHash: null,
      algorithmVersion: "three-coin-v1",
    });
    isolated.addQuestionVersion({ castingSessionId: casting.id, context: "private context", versionNumber: 1, reason: "initial" });
    isolated.saveStep({ castingSessionId: casting.id, stepKind: "coin", lineIndex: 0, changeIndex: null, rawRecord: { nested: true }, lineValue: 7 });
    isolated.saveCastResult({ castingSessionId: casting.id, lineValues: [7, 7, 7, 7, 7, 7], methodCalculation: { private: true } });
    isolated.transitionCasting(casting.id, "revealed");
    loginIntentRepository.createLoginIntent({
      castingSessionId: casting.id,
      anonymousSessionHash: "historical-anonymous-owner",
      nonceHash: "hashed-nonce",
      nonceKeyVersion: "v1",
      allowedCallbackPath: `/result/${casting.id}`,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    isolated.savePreviewSuccess(casting.id, "preview");
    const reading = isolated.getOrCreateReading(casting.id);
    isolated.grantEntitlement({ userId: user.id, productId: "one", quantity: 1, amountUsd: 2.99 });
    const frozen = isolated.freezeForReading(reading.id, user.id, new Date());
    if (!("reservationId" in frozen)) throw new Error("expected reservation");
    isolated.completeReadingConsume(frozen.reservationId, { coreSummary: "delivered" });
    isolated.createQualityReview({ readingId: reading.id, userId: user.id, reason: "review" });
    isolated.acquireQuestionLock({ userId: user.id, fingerprint: "complete-purge", keyVersion: "v1", winningCastingId: casting.id, now: new Date() });
    isolated.createOrder({ userId: user.id, productId: "one", amountUsd: 2.99, currency: "USD", requestId: crypto.randomUUID() });

    isolated.requestCastingDeletion(casting.id);
    expect(isolated.purgeDeletedCasts(new Date(Date.now() + 31 * 24 * 3600 * 1000))).toBe(1);

    expect(store.castingSessions.size).toBe(0);
    expect(store.loginIntents.size).toBe(0);
    expect(store.questionVersions.size).toBe(0);
    expect(store.castingSteps.size).toBe(0);
    expect(store.castResults.size).toBe(0);
    expect(store.previews.size).toBe(0);
    expect(store.readings.size).toBe(0);
    expect(store.reservations.size).toBe(0);
    expect(store.qualityReviews.size).toBe(0);
    expect(store.questionLocks.size).toBe(0);
    expect(store.users.size).toBe(1);
    expect(store.sessions.size).toBe(1);
    expect(store.entitlementBatches.size).toBe(1);
    expect(store.entitlementLedger.length).toBe(3);
    expect(store.orders.size).toBe(1);
  });

  it("purges question locks belonging to the deleted casting", () => {
    const { user, casting } = createRevealedCasting();
    const now = new Date();
    const fingerprint = `purge-lock-${crypto.randomUUID()}`;
    repo.acquireQuestionLock({ userId: user.id, fingerprint, keyVersion: "v1", winningCastingId: casting.id, now });
    repo.requestCastingDeletion(casting.id);
    repo.purgeDeletedCasts(new Date(now.getTime() + 31 * 24 * 3600 * 1000));

    expect(repo.acquireQuestionLock({
      userId: user.id,
      fingerprint,
      keyVersion: "v1",
      winningCastingId: `replacement-${crypto.randomUUID()}`,
      now: new Date(now.getTime() + 60 * 60 * 1000),
    }).won).toBe(true);
  });

  it("purges reviews belonging to a deleted casting", () => {
    const { user, casting } = createRevealedCasting();
    const reading = repo.getOrCreateReading(casting.id);
    repo.grantEntitlement({ userId: user.id, productId: "one", quantity: 1, amountUsd: 2.99 });
    const frozen = repo.freezeForReading(reading.id, user.id, new Date());
    if (!("reservationId" in frozen)) throw new Error("expected reservation");
    repo.completeReadingConsume(frozen.reservationId, { coreSummary: "done" });
    const review = repo.createQualityReview({ readingId: reading.id, userId: user.id, reason: "review" });
    repo.requestCastingDeletion(casting.id);
    repo.purgeDeletedCasts(new Date(Date.now() + 31 * 24 * 3600 * 1000));

    expect(() => repo.decideQualityReview(review.id, true)).toThrow("REVIEW_NOT_FOUND");
  });
});
