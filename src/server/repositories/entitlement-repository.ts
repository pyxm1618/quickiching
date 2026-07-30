import type { EntitlementBatch } from "@/domain/entitlements/batch";
import type { Order } from "./models";

export interface EntitlementRepository {
  getBatches(userId: string): EntitlementBatch[];
  grantEntitlement(input: { userId: string; productId: string; quantity: number; amountUsd: number }): EntitlementBatch;
  freezeForReading(readingId: string, userId: string, now: Date): { reservationId: string } | { error: string };
  consumeReservation(reservationId: string, now: Date): { readingId: string; changed: boolean };
  releaseReservation(reservationId: string, expired: boolean, now: Date): { readingId: string; changed: boolean };
  createOrder(input: { userId: string; productId: string; amountUsd: number; currency: string; requestId: string }): Order;
  getOrder(id: string): Order | undefined;
  markOrderPaid(orderId: string, providerCheckoutId: string): Order;
}
