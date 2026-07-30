import { describe, expect, it } from "vitest";
import { createMemoryRepositories } from "@/server/repositories/memory";
import { EntitlementService } from "./entitlement-service";

function fixture() {
  const repositories = createMemoryRepositories();
  const user = repositories.identityRepository.createUser("entitlement-service@example.com");
  const service = new EntitlementService({
    entitlementRepository: repositories.entitlementRepository,
    readingRepository: repositories.readingRepository,
    clock: { now: () => new Date("2026-07-30T00:00:00.000Z") },
  });
  return { repositories, user, service };
}

describe("EntitlementService", () => {
  it("reserves one credit idempotently and preserves non-negative batch counters", () => {
    const { repositories, user, service } = fixture();
    const casting = repositories.castingRepository.createCastingSession({
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: user.id,
      anonHash: null,
      algorithmVersion: "three-coin-v1",
    });
    const reading = repositories.readingRepository.getOrCreateReading(casting.id);
    repositories.entitlementRepository.grantEntitlement({
      userId: user.id,
      productId: "one",
      quantity: 1,
      amountUsd: 2.99,
    });

    const first = service.reserveForReading(reading.id, user.id);
    const replay = service.reserveForReading(reading.id, user.id);

    expect(replay).toEqual(first);
    expect(repositories.entitlementRepository.getBatches(user.id)[0]).toMatchObject({
      quantityAvailable: 0,
      quantityReserved: 1,
      quantityConsumed: 0,
      quantityRevoked: 0,
    });
  });

  it("consumes once and rejects a duplicate terminal transition", () => {
    const { repositories, user, service } = fixture();
    const casting = repositories.castingRepository.createCastingSession({
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: user.id,
      anonHash: null,
      algorithmVersion: "three-coin-v1",
    });
    const reading = repositories.readingRepository.getOrCreateReading(casting.id);
    repositories.entitlementRepository.grantEntitlement({
      userId: user.id,
      productId: "one",
      quantity: 1,
      amountUsd: 2.99,
    });
    const reserved = service.reserveForReading(reading.id, user.id);

    expect(service.consume(reserved.reservationId).changed).toBe(true);
    expect(service.consume(reserved.reservationId).changed).toBe(false);
    expect(() => service.release(reserved.reservationId, false)).toThrow("RESERVATION_TERMINAL");
  });

  it("releases an unexpired reservation and revokes an expired reservation", () => {
    const { repositories, user, service } = fixture();
    const createReading = () => {
      const casting = repositories.castingRepository.createCastingSession({
        method: "three_coin",
        scene: "career",
        interpretationGoal: "what_do_i_need_to_see_clearly",
        userId: user.id,
        anonHash: null,
        algorithmVersion: "three-coin-v1",
      });
      return repositories.readingRepository.getOrCreateReading(casting.id);
    };
    repositories.entitlementRepository.grantEntitlement({
      userId: user.id,
      productId: "two-test",
      quantity: 2,
      amountUsd: 5.98,
    });

    const first = service.reserveForReading(createReading().id, user.id);
    expect(service.release(first.reservationId, false).changed).toBe(true);
    const second = service.reserveForReading(createReading().id, user.id);
    expect(service.release(second.reservationId, true).changed).toBe(true);

    expect(repositories.entitlementRepository.getBatches(user.id)[0]).toMatchObject({
      quantityAvailable: 1,
      quantityReserved: 0,
      quantityRevoked: 1,
    });
  });

  it("returns an explicit unavailable error when all batches are expired or empty", () => {
    const { repositories, user, service } = fixture();
    const casting = repositories.castingRepository.createCastingSession({
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: user.id,
      anonHash: null,
      algorithmVersion: "three-coin-v1",
    });
    const reading = repositories.readingRepository.getOrCreateReading(casting.id);

    expect(() => service.reserveForReading(reading.id, user.id)).toThrow("ENTITLEMENT_NOT_AVAILABLE");
  });
});
