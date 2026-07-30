import { and, asc, eq, gt, inArray } from "drizzle-orm";
import type { PostgresDatabase } from "@/server/db/client";
import {
  entitlementBatches,
  entitlementLedger,
  readings,
  reservations,
} from "@/server/db/schema";
import { DomainError } from "@/server/errors/domain-error";
import type { AsyncEntitlementRepository } from "./ports";
import { mapReservation, postgresId } from "./helpers";

const RESERVATION_TTL_MS = 30 * 60 * 1000;

export class PostgresEntitlementRepository implements AsyncEntitlementRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async reserveForReading(readingId: string, userId: string, now: Date) {
    return this.database.transaction(async (tx) => {
      const [reading] = await tx.select().from(readings)
        .where(eq(readings.id, readingId))
        .for("update")
        .limit(1);
      if (!reading) throw new DomainError("READING_NOT_FOUND", "Reading not found.", false);
      if (reading.activeReservationId) {
        const [existing] = await tx.select().from(reservations)
          .where(eq(reservations.id, reading.activeReservationId))
          .limit(1);
        if (existing && ["reserved", "consumed"].includes(existing.status)) {
          return { reservationId: existing.id };
        }
      }

      const [batch] = await tx.select().from(entitlementBatches)
        .where(and(
          eq(entitlementBatches.userId, userId),
          gt(entitlementBatches.quantityAvailable, 0),
          gt(entitlementBatches.expiresAt, now),
        ))
        .orderBy(asc(entitlementBatches.expiresAt), asc(entitlementBatches.createdAt))
        .for("update")
        .limit(1);
      if (!batch) {
        throw new DomainError("ENTITLEMENT_NOT_AVAILABLE", "No reading credit is available.", false);
      }

      const reservationId = postgresId("res");
      await tx.update(entitlementBatches).set({
        quantityAvailable: batch.quantityAvailable - 1,
        quantityReserved: batch.quantityReserved + 1,
        updatedAt: now,
      }).where(eq(entitlementBatches.id, batch.id));
      await tx.insert(entitlementLedger).values({
        id: postgresId("led"),
        batchId: batch.id,
        action: "freeze",
        quantity: 1,
        eventKey: `reservation:${reservationId}:freeze`,
        referenceType: "reservation",
        referenceId: reservationId,
        metadata: { readingId },
        createdAt: now,
      });
      await tx.insert(reservations).values({
        id: reservationId,
        readingId,
        batchId: batch.id,
        status: "reserved",
        expiresAt: new Date(now.getTime() + RESERVATION_TTL_MS),
        createdAt: now,
        updatedAt: now,
      });
      await tx.update(readings).set({
        activeReservationId: reservationId,
        status: "reserved",
        updatedAt: now,
      }).where(eq(readings.id, readingId));
      return { reservationId };
    });
  }

  async getReservation(reservationId: string) {
    const [row] = await this.database.select().from(reservations)
      .where(eq(reservations.id, reservationId))
      .limit(1);
    return row ? mapReservation(row) : undefined;
  }

  async consumeReservation(reservationId: string, eventId: string, now: Date) {
    return this.database.transaction(async (tx) => {
      const [reservation] = await tx.select().from(reservations)
        .where(eq(reservations.id, reservationId))
        .for("update")
        .limit(1);
      if (!reservation) throw new DomainError("RESERVATION_NOT_FOUND", "Reservation not found.", false);
      if (reservation.status === "consumed") return false;
      if (reservation.status !== "reserved") {
        throw new DomainError("RESERVATION_TERMINAL", "Reservation is already closed.", false);
      }
      const [batch] = await tx.select().from(entitlementBatches)
        .where(eq(entitlementBatches.id, reservation.batchId))
        .for("update")
        .limit(1);
      if (!batch) throw new Error("ENTITLEMENT_BATCH_NOT_FOUND");
      await tx.update(entitlementBatches).set({
        quantityReserved: batch.quantityReserved - 1,
        quantityConsumed: batch.quantityConsumed + 1,
        updatedAt: now,
      }).where(eq(entitlementBatches.id, batch.id));
      await tx.insert(entitlementLedger).values({
        id: postgresId("led"),
        batchId: batch.id,
        action: "consume",
        quantity: 1,
        eventKey: eventId,
        referenceType: "reservation",
        referenceId: reservationId,
        metadata: { readingId: reservation.readingId },
        createdAt: now,
      });
      await tx.update(reservations).set({
        status: "consumed",
        terminalEventId: eventId,
        terminalAt: now,
        updatedAt: now,
      }).where(eq(reservations.id, reservationId));
      return true;
    });
  }

  async releaseReservation(reservationId: string, eventId: string, expired: boolean, now: Date) {
    return this.database.transaction(async (tx) => {
      const [reservation] = await tx.select().from(reservations)
        .where(eq(reservations.id, reservationId))
        .for("update")
        .limit(1);
      if (!reservation) throw new DomainError("RESERVATION_NOT_FOUND", "Reservation not found.", false);
      if (reservation.status !== "reserved") return false;
      const [batch] = await tx.select().from(entitlementBatches)
        .where(eq(entitlementBatches.id, reservation.batchId))
        .for("update")
        .limit(1);
      if (!batch) throw new Error("ENTITLEMENT_BATCH_NOT_FOUND");
      await tx.update(entitlementBatches).set({
        quantityReserved: batch.quantityReserved - 1,
        quantityAvailable: batch.quantityAvailable + (expired ? 0 : 1),
        quantityRevoked: batch.quantityRevoked + (expired ? 1 : 0),
        updatedAt: now,
      }).where(eq(entitlementBatches.id, batch.id));
      await tx.insert(entitlementLedger).values({
        id: postgresId("led"),
        batchId: batch.id,
        action: expired ? "expire" : "release",
        quantity: 1,
        eventKey: eventId,
        referenceType: "reservation",
        referenceId: reservationId,
        metadata: { readingId: reservation.readingId },
        createdAt: now,
      });
      await tx.update(reservations).set({
        status: expired ? "expired" : "released",
        terminalEventId: eventId,
        terminalAt: now,
        updatedAt: now,
      }).where(eq(reservations.id, reservationId));
      await tx.update(readings).set({
        activeReservationId: null,
        status: "failed",
        updatedAt: now,
      }).where(and(
        eq(readings.id, reservation.readingId),
        inArray(readings.status, ["reserved", "queued", "generating", "validating"]),
      ));
      return true;
    });
  }
}
