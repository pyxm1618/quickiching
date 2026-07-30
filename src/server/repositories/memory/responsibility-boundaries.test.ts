import { describe, expect, it } from "vitest";
import type { Reading } from "../models";
import { createMemoryRepositories } from "./index";

type FocusedReadingTransitions = {
  markReadingReserved?: (readingId: string, reservationId: string, now: Date) => Reading;
  completeReading?: (readingId: string, reservationId: string, report: Record<string, unknown>, now: Date) => Reading;
  failReading?: (readingId: string, reservationId: string, now: Date) => Reading;
};

type FocusedEntitlementTransitions = {
  consumeReservation?: (reservationId: string, now: Date) => { readingId: string; changed: boolean };
  releaseReservation?: (reservationId: string, expired: boolean, now: Date) => { readingId: string; changed: boolean };
};

describe("memory repository responsibility boundaries", () => {
  it("keeps entitlement reservation writes out of Reading storage", () => {
    const repositories = createMemoryRepositories();
    const { repo, entitlementRepository, readingRepository } = repositories;
    const user = repo.createUser(`focused-${crypto.randomUUID()}@example.com`);
    const casting = repo.createCastingSession({
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: null,
      anonHash: `anon-${crypto.randomUUID()}`,
      algorithmVersion: "three-coin-v1",
    });
    const reading = readingRepository.getOrCreateReading(casting.id);
    entitlementRepository.grantEntitlement({ userId: user.id, productId: "one", quantity: 1, amountUsd: 2.99 });

    const frozen = entitlementRepository.freezeForReading(reading.id, user.id, new Date());

    expect(frozen).toHaveProperty("reservationId");
    expect(readingRepository.getReading(reading.id)).toMatchObject({ status: "not_started", reservationId: null });
  });

  it("exposes Reading transitions only from the Reading port", () => {
    const repositories = createMemoryRepositories();
    const readingTransitions = repositories.readingRepository as typeof repositories.readingRepository & FocusedReadingTransitions;
    const entitlementTransitions = repositories.entitlementRepository as typeof repositories.entitlementRepository & FocusedEntitlementTransitions;
    const legacyEntitlement = repositories.entitlementRepository as unknown as { completeReadingConsume?: unknown; releaseReading?: unknown };

    expect(readingTransitions.markReadingReserved).toBeTypeOf("function");
    expect(readingTransitions.completeReading).toBeTypeOf("function");
    expect(readingTransitions.failReading).toBeTypeOf("function");
    expect(entitlementTransitions.consumeReservation).toBeTypeOf("function");
    expect(entitlementTransitions.releaseReservation).toBeTypeOf("function");
    expect(legacyEntitlement.completeReadingConsume).toBeUndefined();
    expect(legacyEntitlement.releaseReading).toBeUndefined();
  });

  it("lets focused ports transition entitlement and Reading independently", () => {
    const repositories = createMemoryRepositories();
    const { repo, entitlementRepository, readingRepository } = repositories;
    const readingTransitions = readingRepository as typeof readingRepository & FocusedReadingTransitions;
    const entitlementTransitions = entitlementRepository as typeof entitlementRepository & FocusedEntitlementTransitions;
    expect(readingTransitions.markReadingReserved).toBeTypeOf("function");
    expect(readingTransitions.completeReading).toBeTypeOf("function");
    expect(entitlementTransitions.consumeReservation).toBeTypeOf("function");
    if (!readingTransitions.markReadingReserved || !readingTransitions.completeReading || !entitlementTransitions.consumeReservation) return;

    const user = repo.createUser(`focused-flow-${crypto.randomUUID()}@example.com`);
    const casting = repo.createCastingSession({
      method: "three_coin",
      scene: "career",
      interpretationGoal: "what_do_i_need_to_see_clearly",
      userId: null,
      anonHash: `anon-${crypto.randomUUID()}`,
      algorithmVersion: "three-coin-v1",
    });
    const reading = readingRepository.getOrCreateReading(casting.id);
    entitlementRepository.grantEntitlement({ userId: user.id, productId: "one", quantity: 1, amountUsd: 2.99 });
    const frozen = entitlementRepository.freezeForReading(reading.id, user.id, new Date());
    if (!("reservationId" in frozen)) throw new Error("expected reservation");

    readingTransitions.markReadingReserved(reading.id, frozen.reservationId, new Date());
    expect(readingRepository.getReading(reading.id)).toMatchObject({ status: "reserved", reservationId: frozen.reservationId });
    expect(entitlementTransitions.consumeReservation(frozen.reservationId, new Date())).toEqual({ readingId: reading.id, changed: true });
    expect(readingRepository.getReading(reading.id)?.status).toBe("reserved");
    readingTransitions.completeReading(reading.id, frozen.reservationId, { coreSummary: "done" }, new Date());
    expect(readingRepository.getReading(reading.id)).toMatchObject({ status: "completed", report: { coreSummary: "done" } });
  });
});
