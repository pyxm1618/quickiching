import type { MemoryEntitlementRepository } from "./entitlement-repository";
import type { MemoryReadingRepository } from "./reading-repository";
import { cloneForStorage } from "./snapshot";
import type { MemoryStore } from "./store";

export class MemoryRepositoryCoordinator {
  constructor(
    private readonly store: MemoryStore,
    private readonly readings: MemoryReadingRepository,
    private readonly entitlements: MemoryEntitlementRepository,
  ) {}

  freezeForReading(readingId: string, userId: string, now: Date): { reservationId: string } | { error: string } {
    return this.store.withLock(() => {
      if (!this.store.readings.has(readingId)) return { error: "READING_NOT_FOUND" };
      const frozen = this.entitlements.freezeForReadingInTransaction(readingId, userId, now);
      if ("reservationId" in frozen) {
        this.readings.markReadingReservedInTransaction(readingId, frozen.reservationId, now);
      }
      return frozen;
    });
  }

  completeReadingConsume(reservationId: string, report: Record<string, unknown>): void {
    const preparedReport = cloneForStorage(report);
    this.store.withLock(() => {
      const reservation = this.store.reservations.get(reservationId);
      if (!reservation) throw new Error("RESERVATION_NOT_FOUND");
      const reading = this.store.readings.get(reservation.readingId);
      if (!reading || reading.reservationId !== reservationId) throw new Error("READING_NOT_FOUND");
      if (reservation.status === "consumed") return;
      const now = new Date();
      const consumed = this.entitlements.consumeReservationInTransaction(reservationId, now);
      if (consumed.changed) {
        this.readings.completeReadingInTransaction(consumed.readingId, reservationId, preparedReport, now);
      }
    });
  }

  releaseReading(reservationId: string, expired: boolean): void {
    this.store.withLock(() => {
      const reservation = this.store.reservations.get(reservationId);
      if (!reservation) throw new Error("RESERVATION_NOT_FOUND");
      const reading = this.store.readings.get(reservation.readingId);
      if (!reading || (reservation.status === "reserved" && reading.reservationId !== reservationId)) {
        throw new Error("READING_NOT_FOUND");
      }
      const now = new Date();
      const released = this.entitlements.releaseReservationInTransaction(reservationId, expired, now);
      if (released.changed) this.readings.failReadingInTransaction(released.readingId, reservationId, now);
    });
  }
}
