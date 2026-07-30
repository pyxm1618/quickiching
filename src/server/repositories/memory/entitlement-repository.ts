import {
  batchIdentityHolds,
  consumeReserved,
  freezeOne,
  releaseReserved,
  type EntitlementBatch,
} from "@/domain/entitlements/batch";
import { entitlementExpiry } from "@/domain/entitlements/pricing";
import type { EntitlementRepository } from "../entitlement-repository";
import type { Order, Reservation } from "../models";
import { cloneForStorage, snapshot } from "./snapshot";
import { memoryId, repositoryError, type MemoryStore } from "./store";

export class MemoryEntitlementRepository implements EntitlementRepository {
  constructor(private readonly store: MemoryStore) {}

  getBatches(userId: string): EntitlementBatch[] {
    return snapshot(this.ownedBatches(userId));
  }

  grantEntitlement(input: { userId: string; productId: string; quantity: number; amountUsd: number }): EntitlementBatch {
    return this.store.withLock(() => {
      const now = new Date();
      const batch: EntitlementBatch = {
        id: `bat_${input.userId}_${memoryId("b")}`,
        quantityTotal: input.quantity,
        quantityAvailable: input.quantity,
        quantityReserved: 0,
        quantityConsumed: 0,
        quantityRevoked: 0,
        expiresAt: entitlementExpiry(now),
      };
      this.store.entitlementBatches.set(batch.id, batch);
      this.store.entitlementLedger.push({
        id: memoryId("led"),
        batchId: batch.id,
        action: input.productId === "quality-review-compensation" ? "compensate" : "grant",
        quantity: input.quantity,
        createdAt: now,
      });
      void input.amountUsd;
      if (!batchIdentityHolds(batch)) throw new Error("ENTITLEMENT_IDENTITY_BROKEN");
      return snapshot(batch);
    });
  }

  freezeForReading(readingId: string, userId: string, now: Date): { reservationId: string } | { error: string } {
    return this.store.withLock(() => this.freezeForReadingInTransaction(readingId, userId, now));
  }

  getReservation(reservationId: string): Reservation | undefined {
    const reservation = this.store.reservations.get(reservationId);
    return reservation ? snapshot(reservation) : undefined;
  }

  consumeReservation(reservationId: string, now: Date): { readingId: string; changed: boolean } {
    return this.store.withLock(() => this.consumeReservationInTransaction(reservationId, now));
  }

  releaseReservation(reservationId: string, expired: boolean, now: Date): { readingId: string; changed: boolean } {
    return this.store.withLock(() => this.releaseReservationInTransaction(reservationId, expired, now));
  }

  /** @internal Used only by the memory composition coordinator inside one store lock. */
  freezeForReadingInTransaction(readingId: string, userId: string, now: Date): { reservationId: string } | { error: string } {
    const activeId = this.activeOrCompletedReservationId(readingId);
    if (activeId) return { reservationId: activeId };
    const transactionNow = new Date(now);
    const frozen = freezeOne(this.ownedBatches(userId), transactionNow, readingId, memoryId("led"));
    if (frozen.kind === "unavailable") return { error: "ENTITLEMENT_NOT_AVAILABLE" };
    this.store.entitlementBatches.set(frozen.batch.id, cloneForStorage(frozen.batch));
    this.store.entitlementLedger.push(cloneForStorage(frozen.entry));
    const reservation: Reservation = {
      id: memoryId("res"),
      readingId,
      batchId: frozen.batch.id,
      status: "reserved",
      createdAt: transactionNow,
      updatedAt: transactionNow,
    };
    this.store.reservations.set(reservation.id, reservation);
    return { reservationId: reservation.id };
  }

  /** @internal Used only by the memory composition coordinator inside one store lock. */
  consumeReservationInTransaction(reservationId: string, now: Date): { readingId: string; changed: boolean } {
    const reservation = this.requireReservation(reservationId);
    if (reservation.status === "consumed") return { readingId: reservation.readingId, changed: false };
    if (reservation.status !== "reserved") throw repositoryError("RESERVATION_NOT_ACTIVE");
    const batch = this.store.entitlementBatches.get(reservation.batchId);
    if (!batch) throw new Error("BATCH_NOT_FOUND");
    const transactionNow = new Date(now);
    const consumed = consumeReserved(batch, reservationId, memoryId("led"), transactionNow);
    this.store.entitlementBatches.set(batch.id, cloneForStorage(consumed.batch));
    this.store.entitlementLedger.push(cloneForStorage(consumed.entry));
    reservation.status = "consumed";
    reservation.updatedAt = transactionNow;
    return { readingId: reservation.readingId, changed: true };
  }

  /** @internal Used only by the memory composition coordinator inside one store lock. */
  releaseReservationInTransaction(
    reservationId: string,
    expired: boolean,
    now: Date,
  ): { readingId: string; changed: boolean } {
    const reservation = this.requireReservation(reservationId);
    if (reservation.status !== "reserved") return { readingId: reservation.readingId, changed: false };
    const batch = this.store.entitlementBatches.get(reservation.batchId);
    if (!batch) throw new Error("BATCH_NOT_FOUND");
    const transactionNow = new Date(now);
    const released = releaseReserved(batch, memoryId("led"), transactionNow, expired);
    this.store.entitlementBatches.set(batch.id, cloneForStorage(released.batch));
    this.store.entitlementLedger.push(cloneForStorage(released.entry));
    reservation.status = expired ? "expired" : "released";
    reservation.updatedAt = transactionNow;
    return { readingId: reservation.readingId, changed: true };
  }

  createOrder(input: { userId: string; productId: string; amountUsd: number; currency: string; requestId: string }): Order {
    const now = new Date();
    const order: Order = {
      id: memoryId("ord"),
      userId: input.userId,
      productId: input.productId,
      amountUsd: input.amountUsd,
      currency: input.currency,
      requestId: input.requestId,
      providerCheckoutId: null,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    this.store.orders.set(order.id, order);
    return snapshot(order);
  }

  getOrder(id: string): Order | undefined {
    const order = this.store.orders.get(id);
    return order ? snapshot(order) : undefined;
  }

  markOrderPaid(orderId: string, providerCheckoutId: string): Order {
    const order = this.store.orders.get(orderId);
    if (!order) throw repositoryError("ORDER_NOT_FOUND");
    order.status = "paid";
    order.providerCheckoutId = providerCheckoutId;
    order.updatedAt = new Date();
    return snapshot(order);
  }

  private activeOrCompletedReservationId(readingId: string): string | null {
    const reservation = [...this.store.reservations.values()].find(
      (candidate) => candidate.readingId === readingId && ["reserved", "consumed"].includes(candidate.status),
    );
    return reservation?.id ?? null;
  }

  private ownedBatches(userId: string): EntitlementBatch[] {
    return [...this.store.entitlementBatches.values()].filter((batch) => batch.id.startsWith(`bat_${userId}`));
  }

  private requireReservation(reservationId: string): Reservation {
    const reservation = this.store.reservations.get(reservationId);
    if (!reservation) throw new Error("RESERVATION_NOT_FOUND");
    return reservation;
  }
}
