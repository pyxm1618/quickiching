import type { EntitlementBatch } from "@/domain/entitlements/batch";
import type { Order, Reservation } from "./models";

export interface EntitlementRepository {
  getBatches(userId: string): EntitlementBatch[];
  grantEntitlement(input: {
    userId: string;
    productId: string;
    quantity: number;
    amountUsd: number;
    orderId?: string | null;
    reviewId?: string | null;
  }): EntitlementBatch;
  freezeForReading(readingId: string, userId: string, now: Date): { reservationId: string } | { error: string };
  getReservation(reservationId: string): Reservation | undefined;
  consumeReservation(reservationId: string, now: Date): { readingId: string; changed: boolean };
  releaseReservation(reservationId: string, expired: boolean, now: Date): { readingId: string; changed: boolean };
  createOrder(input: { userId: string; productId: string; amountUsd: number; currency: string; requestId: string }): Order;
  getOrder(id: string): Order | undefined;
  markOrderPaid(orderId: string, providerCheckoutId: string): Order;
}
