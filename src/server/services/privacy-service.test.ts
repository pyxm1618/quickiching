import { describe, expect, it } from "vitest";
import { createMemoryRepositories, MemoryStore } from "@/server/repositories/memory";
import { PrivacyService } from "./privacy-service";

function revealedFixture() {
  const store = new MemoryStore();
  const repositories = createMemoryRepositories(store);
  const user = repositories.identityRepository.createUser("privacy-service@example.com");
  const casting = repositories.castingRepository.createCastingSession({
    method: "three_coin",
    scene: "career",
    interpretationGoal: "what_do_i_need_to_see_clearly",
    userId: user.id,
    anonHash: null,
    algorithmVersion: "three-coin-v1",
  });
  repositories.castingRepository.addQuestionVersion({
    castingSessionId: casting.id,
    context: "What should I understand about this career transition?",
    versionNumber: 1,
    reason: "initial",
  });
  repositories.castingRepository.recordRiskCheck({
    castingSessionId: casting.id,
    ruleVersion: "risk-v2",
    matchedRuleCodes: [],
    reasonCode: "none",
    status: "allowed",
  });
  for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
    repositories.castingRepository.saveStep({
      castingSessionId: casting.id,
      stepKind: "coin",
      lineIndex,
      changeIndex: null,
      rawRecord: { coinFaces: ["yang", "yin", "yin"] },
      lineValue: 7,
    });
  }
  repositories.castingRepository.saveCastResult({
    castingSessionId: casting.id,
    lineValues: [7, 7, 7, 7, 7, 7],
    methodCalculation: {
      kind: "three-coin",
      rounds: Array.from({ length: 6 }, (_, lineIndex) => ({
        linePosition: lineIndex + 1,
        coinValues: [3, 2, 2],
        lineValue: 7,
      })),
    },
  });
  repositories.castingRepository.transitionCasting(casting.id, "revealed");
  const current = { value: new Date("2026-07-30T00:00:00.000Z") };
  const service = new PrivacyService({
    privacyRepository: repositories.privacyRepository,
    castingRepository: repositories.castingRepository,
    clock: { now: () => new Date(current.value) },
  });
  return { store, repositories, user, casting, current, service };
}

describe("PrivacyService", () => {
  it("marks an owned revealed casting for deletion with a 30-day recovery window", () => {
    const { casting, user, service } = revealedFixture();
    const deleted = service.requestDeletion(casting.id, user.id);
    expect(deleted).toMatchObject({
      lifecycle: "user_deleted",
      purgeAfter: new Date("2026-08-29T00:00:00.000Z"),
    });
    expect(service.listRecoverable(user.id)).toHaveLength(1);
  });

  it("restores during the recovery window and refuses recovery after expiry", () => {
    const { casting, user, current, service } = revealedFixture();
    service.requestDeletion(casting.id, user.id);
    expect(service.restore(casting.id, user.id).lifecycle).toBe("revealed");
    service.requestDeletion(casting.id, user.id);
    current.value = new Date("2026-08-29T00:00:00.001Z");
    expect(() => service.restore(casting.id, user.id)).toThrow("DELETION_RECOVERY_CLOSED");
  });

  it("purges all personal casting content after the recovery window while retaining financial records", () => {
    const { store, repositories, casting, user, current, service } = revealedFixture();
    repositories.entitlementRepository.grantEntitlement({
      userId: user.id,
      productId: "one",
      quantity: 1,
      amountUsd: 2.99,
    });
    repositories.entitlementRepository.createOrder({
      userId: user.id,
      productId: "one",
      amountUsd: 2.99,
      currency: "USD",
      requestId: "financial-retention",
    });
    service.requestDeletion(casting.id, user.id);
    current.value = new Date("2026-08-30T00:00:00.000Z");

    expect(service.purgeDue()).toBe(1);
    expect(store.castingSessions.size).toBe(0);
    expect(store.questionVersions.size).toBe(0);
    expect(store.castResults.size).toBe(0);
    expect(store.users.size).toBe(1);
    expect(store.orders.size).toBe(1);
    expect(store.entitlementBatches.size).toBe(1);
  });

  it("immediately revokes sessions and schedules every personal casting when account deletion is requested", () => {
    const { store, repositories, casting, user, service } = revealedFixture();
    repositories.identityRepository.createSession(user.id);
    const draft = repositories.castingRepository.createCastingSession({
      method: "three_coin",
      scene: "relationships",
      interpretationGoal: "what_is_blocking_this_situation",
      userId: user.id,
      anonHash: null,
      algorithmVersion: "three-coin-v1",
    });

    const request = service.requestAccountDeletion(user.id);

    expect(request).toMatchObject({
      requestedAt: new Date("2026-07-30T00:00:00.000Z"),
      purgeAfter: new Date("2026-08-29T00:00:00.000Z"),
      restoredAt: null,
      purgedAt: null,
    });
    expect(store.sessions.size).toBe(0);
    expect(store.castingSessions.get(casting.id)?.lifecycle).toBe("user_deleted");
    expect(store.castingSessions.get(draft.id)?.lifecycle).toBe("user_deleted");
  });

  it("restores exact pre-deletion casting lifecycles during the account recovery window", () => {
    const { store, repositories, casting, user, current, service } = revealedFixture();
    const draft = repositories.castingRepository.createCastingSession({
      method: "three_coin",
      scene: "relationships",
      interpretationGoal: "what_is_blocking_this_situation",
      userId: user.id,
      anonHash: null,
      algorithmVersion: "three-coin-v1",
    });
    service.requestAccountDeletion(user.id);
    current.value = new Date("2026-08-15T00:00:00.000Z");

    expect(service.restoreAccount(user.id).restoredAt).toEqual(current.value);
    expect(store.castingSessions.get(casting.id)?.lifecycle).toBe("revealed");
    expect(store.castingSessions.get(draft.id)?.lifecycle).toBe("draft");
    expect(store.users.get(user.id)?.deletionRequestedAt).toBeNull();
  });

  it("physically purges personal data and anonymizes the retained financial subject after account expiry", () => {
    const { store, repositories, user, current, service } = revealedFixture();
    const originalEmail = user.email;
    repositories.identityRepository.createSession(user.id);
    repositories.entitlementRepository.grantEntitlement({
      userId: user.id,
      productId: "one",
      quantity: 1,
      amountUsd: 2.99,
    });
    repositories.entitlementRepository.createOrder({
      userId: user.id,
      productId: "one",
      amountUsd: 2.99,
      currency: "USD",
      requestId: "account-financial-retention",
    });
    service.requestAccountDeletion(user.id);
    current.value = new Date("2026-08-30T00:00:00.000Z");

    expect(service.purgeDueAccounts()).toBe(1);
    expect(store.sessions.size).toBe(0);
    expect(store.castingSessions.size).toBe(0);
    expect(store.questionVersions.size).toBe(0);
    expect(store.castingSteps.size).toBe(0);
    expect(store.castResults.size).toBe(0);
    expect(store.readings.size).toBe(0);
    expect(store.qualityReviews.size).toBe(0);
    expect(store.orders.size).toBe(1);
    expect(store.entitlementBatches.size).toBe(1);
    expect(store.entitlementLedger.length).toBeGreaterThan(0);
    expect(store.users.get(user.id)?.email).toMatch(/^deleted-[a-f0-9]{24}@deleted\.invalid$/);
    expect(repositories.identityRepository.getUserByEmail(originalEmail)).toBeUndefined();
    expect(service.getAccountDeletion(user.id)?.purgedAt).toEqual(current.value);
  });
});
