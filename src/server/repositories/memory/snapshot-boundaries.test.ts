import { describe, expect, it } from "vitest";
import { createMemoryRepositories, MemoryStore } from "./index";

function ignoreReadonlyFailure(mutation: () => void): void {
  try {
    mutation();
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
  }
}

function createAnonymousCasting(repo: ReturnType<typeof createMemoryRepositories>["repo"]) {
  return repo.createCastingSession({
    method: "three_coin",
    scene: "career",
    interpretationGoal: "what_do_i_need_to_see_clearly",
    userId: null,
    anonHash: `anon-${crypto.randomUUID()}`,
    algorithmVersion: "three-coin-v1",
  });
}

describe("memory repository defensive snapshots", () => {
  it("does not let a returned casting bypass ownership", () => {
    const { repo } = createMemoryRepositories();
    const owner = repo.createUser(`owner-${crypto.randomUUID()}@example.com`);
    const attacker = repo.createUser(`attacker-${crypto.randomUUID()}@example.com`);
    const casting = repo.createCastingSession({
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: owner.id,
      anonHash: null,
      algorithmVersion: "three-coin-v1",
    });
    const createdAt = casting.createdAt.getTime();

    ignoreReadonlyFailure(() => { casting.userId = attacker.id; });
    ignoreReadonlyFailure(() => { casting.createdAt.setTime(0); });

    expect(repo.ownsCasting(casting.id, attacker.id, null)).toBe(false);
    expect(repo.ownsCasting(casting.id, owner.id, null)).toBe(true);
    expect(repo.getCastingSession(casting.id)).toMatchObject({ userId: owner.id });
    expect(repo.getCastingSession(casting.id)?.createdAt.getTime()).toBe(createdAt);
  });

  it("does not let a returned batch manufacture an extra entitlement", () => {
    const { repo } = createMemoryRepositories();
    const user = repo.createUser(`credit-${crypto.randomUUID()}@example.com`);
    const firstReading = repo.getOrCreateReading(createAnonymousCasting(repo).id);
    const secondReading = repo.getOrCreateReading(createAnonymousCasting(repo).id);
    const granted = repo.grantEntitlement({ userId: user.id, productId: "one", quantity: 1, amountUsd: 2.99 });

    ignoreReadonlyFailure(() => {
      granted.quantityAvailable = 2;
      granted.quantityTotal = 2;
    });

    expect(repo.freezeForReading(firstReading.id, user.id, new Date())).toHaveProperty("reservationId");
    expect(repo.freezeForReading(secondReading.id, user.id, new Date())).toEqual({ error: "ENTITLEMENT_NOT_AVAILABLE" });
  });

  it("copies nested step and result data on both write and read", () => {
    const { repo } = createMemoryRepositories();
    const casting = createAnonymousCasting(repo);
    const rawRecord = { nested: { faces: ["heads", "tails", "heads"] } };
    const step = repo.saveStep({
      castingSessionId: casting.id,
      stepKind: "coin",
      lineIndex: 0,
      changeIndex: null,
      rawRecord,
      lineValue: 7,
    });
    rawRecord.nested.faces[0] = "changed-input";
    ignoreReadonlyFailure(() => {
      ((step.rawRecord as typeof rawRecord).nested.faces)[1] = "changed-output";
    });

    expect(repo.getSteps(casting.id)[0].rawRecord).toEqual({ nested: { faces: ["heads", "tails", "heads"] } });

    const methodCalculation = { nested: { values: [1, 2, 3] } };
    const result = repo.saveCastResult({
      castingSessionId: casting.id,
      lineValues: [7, 7, 7, 7, 7, 7],
      methodCalculation,
    });
    methodCalculation.nested.values[0] = 99;
    ignoreReadonlyFailure(() => { result.lineValues[0] = 9; });
    ignoreReadonlyFailure(() => { result.movingLinePositions.push(6); });
    ignoreReadonlyFailure(() => {
      (result.methodCalculation as typeof methodCalculation).nested.values[1] = 99;
    });

    expect(repo.getCastResult(casting.id)).toMatchObject({
      lineValues: [7, 7, 7, 7, 7, 7],
      movingLinePositions: [],
      methodCalculation: { nested: { values: [1, 2, 3] } },
    });
  });

  it("copies nested reading reports on write and read", () => {
    const { repo } = createMemoryRepositories();
    const user = repo.createUser(`report-${crypto.randomUUID()}@example.com`);
    const reading = repo.getOrCreateReading(createAnonymousCasting(repo).id);
    repo.grantEntitlement({ userId: user.id, productId: "one", quantity: 1, amountUsd: 2.99 });
    const frozen = repo.freezeForReading(reading.id, user.id, new Date());
    if (!("reservationId" in frozen)) throw new Error("expected reservation");
    const report = { sections: [{ title: "original" }] };
    repo.completeReadingConsume(frozen.reservationId, report);
    report.sections[0].title = "changed-input";
    const delivered = repo.getReading(reading.id);
    if (!delivered?.report) throw new Error("expected report");
    ignoreReadonlyFailure(() => {
      (delivered.report as typeof report).sections[0].title = "changed-output";
    });

    expect(repo.getReading(reading.id)?.report).toEqual({ sections: [{ title: "original" }] });
  });

  it("leaves entitlement and Reading state unchanged when a report cannot be cloned", () => {
    const store = new MemoryStore();
    const { repo } = createMemoryRepositories(store);
    const user = repo.createUser(`uncloneable-${crypto.randomUUID()}@example.com`);
    const reading = repo.getOrCreateReading(createAnonymousCasting(repo).id);
    repo.grantEntitlement({ userId: user.id, productId: "one", quantity: 1, amountUsd: 2.99 });
    const frozen = repo.freezeForReading(reading.id, user.id, new Date());
    if (!("reservationId" in frozen)) throw new Error("expected reservation");

    expect(() => repo.completeReadingConsume(frozen.reservationId, { notCloneable: () => true })).toThrow();

    expect([...store.entitlementBatches.values()][0]).toMatchObject({
      quantityAvailable: 0,
      quantityReserved: 1,
      quantityConsumed: 0,
      quantityRevoked: 0,
    });
    expect(store.entitlementLedger.map((entry) => entry.action)).toEqual(["grant", "reserve"]);
    expect(store.reservations.get(frozen.reservationId)?.status).toBe("reserved");
    expect(store.readings.get(reading.id)).toMatchObject({
      status: "reserved",
      reservationId: frozen.reservationId,
      report: null,
    });
  });
});
