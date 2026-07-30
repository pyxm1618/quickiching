import { DomainError } from "@/server/errors/domain-error";
import type { EntitlementRepository } from "@/server/repositories/entitlement-repository";
import type { ReadingRepository } from "@/server/repositories/reading-repository";

export class EntitlementService {
  constructor(private readonly dependencies: {
    entitlementRepository: EntitlementRepository;
    readingRepository: ReadingRepository;
    clock: { now(): Date };
  }) {}

  reserveForReading(readingId: string, userId: string): { reservationId: string } {
    const reading = this.dependencies.readingRepository.getReading(readingId);
    if (!reading) throw new DomainError("READING_NOT_FOUND", "Reading not found", false);
    if (reading.status === "completed" && reading.reservationId) {
      return { reservationId: reading.reservationId };
    }
    if (reading.reservationId) {
      const existing = this.dependencies.entitlementRepository.getReservation(reading.reservationId);
      if (existing?.status === "reserved" || existing?.status === "consumed") {
        return { reservationId: existing.id };
      }
    }

    const frozen = this.dependencies.entitlementRepository.freezeForReading(
      readingId,
      userId,
      this.dependencies.clock.now(),
    );
    if ("error" in frozen) {
      throw new DomainError(frozen.error, "No reading credit is available.", false);
    }
    this.dependencies.readingRepository.markReadingReserved(
      readingId,
      frozen.reservationId,
      this.dependencies.clock.now(),
    );
    return frozen;
  }

  consume(reservationId: string): { readingId: string; changed: boolean } {
    const reservation = this.requireReservation(reservationId);
    if (reservation.status === "consumed") {
      return { readingId: reservation.readingId, changed: false };
    }
    if (reservation.status !== "reserved") {
      throw new DomainError("RESERVATION_TERMINAL", "This credit reservation is already closed.", false);
    }
    return this.dependencies.entitlementRepository.consumeReservation(
      reservationId,
      this.dependencies.clock.now(),
    );
  }

  release(reservationId: string, expired: boolean): { readingId: string; changed: boolean } {
    const reservation = this.requireReservation(reservationId);
    if (reservation.status !== "reserved") {
      throw new DomainError("RESERVATION_TERMINAL", "This credit reservation is already closed.", false);
    }
    const released = this.dependencies.entitlementRepository.releaseReservation(
      reservationId,
      expired,
      this.dependencies.clock.now(),
    );
    this.dependencies.readingRepository.failReading(
      released.readingId,
      reservationId,
      this.dependencies.clock.now(),
    );
    return released;
  }

  private requireReservation(reservationId: string) {
    const reservation = this.dependencies.entitlementRepository.getReservation(reservationId);
    if (!reservation) {
      throw new DomainError("RESERVATION_NOT_FOUND", "Credit reservation not found.", false);
    }
    return reservation;
  }
}
