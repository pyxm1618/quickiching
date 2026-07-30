import type { ReservationStatus } from "../casting/types";

// §13.3 / §13.5 Entitlement batch + ledger identity. The invariant
//   available + reserved + consumed + revoked = total
// must hold for every batch after every mutation. Ledger entries provide the audit trail.

export type EntitlementBatch = {
  id: string;
  quantityTotal: number;
  quantityAvailable: number;
  quantityReserved: number;
  quantityConsumed: number;
  quantityRevoked: number;
  expiresAt: Date;
};

export type LedgerEntry = {
  id: string;
  batchId: string;
  action: "grant" | "reserve" | "consume" | "release" | "expire" | "revoke" | "compensate";
  quantity: number;
  createdAt: Date;
};

export function batchIdentityHolds(b: EntitlementBatch): boolean {
  const quantities = [
    b.quantityTotal,
    b.quantityAvailable,
    b.quantityReserved,
    b.quantityConsumed,
    b.quantityRevoked,
  ];
  return (
    quantities.every((quantity) => Number.isSafeInteger(quantity) && quantity >= 0) &&
    b.quantityAvailable +
      b.quantityReserved +
      b.quantityConsumed +
      b.quantityRevoked ===
    b.quantityTotal
  );
}

export function isBatchUsable(b: EntitlementBatch, now: Date): boolean {
  return b.quantityAvailable > 0 && b.expiresAt.getTime() > now.getTime();
}

// §13.4 Select the earliest-expiring usable batch (FIFO by expiry).
export function selectEarliestExpiringBatch(
  batches: EntitlementBatch[],
  now: Date,
): EntitlementBatch | null {
  const usable = batches.filter((b) => isBatchUsable(b, now));
  if (usable.length === 0) return null;
  return usable.reduce((earliest, b) =>
    b.expiresAt.getTime() < earliest.expiresAt.getTime() ? b : earliest,
  );
}

export type ReservationEffect =
  | { kind: "reserved"; batch: EntitlementBatch; entry: LedgerEntry }
  | { kind: "unavailable" };

// Pure transition for freezing one entitlement from the earliest-expiring usable batch.
export function freezeOne(
  batches: EntitlementBatch[],
  now: Date,
  reservationId: string,
  ledgerId: string,
): ReservationEffect {
  const batch = selectEarliestExpiringBatch(batches, now);
  if (!batch) return { kind: "unavailable" };
  const next: EntitlementBatch = {
    ...batch,
    quantityAvailable: batch.quantityAvailable - 1,
    quantityReserved: batch.quantityReserved + 1,
  };
  if (!batchIdentityHolds(next)) throw new Error("ENTITLEMENT_IDENTITY_BROKEN");
  const entry: LedgerEntry = {
    id: ledgerId,
    batchId: batch.id,
    action: "reserve",
    quantity: 1,
    createdAt: now,
  };
  return { kind: "reserved", batch: next, entry };
}

// §13.5 Completion / failure / expiry paths. All idempotent via caller's completion key.
export function consumeReserved(batch: EntitlementBatch, reservationId: string, ledgerId: string, now: Date) {
  const next: EntitlementBatch = {
    ...batch,
    quantityReserved: batch.quantityReserved - 1,
    quantityConsumed: batch.quantityConsumed + 1,
  };
  if (!batchIdentityHolds(next)) throw new Error("ENTITLEMENT_IDENTITY_BROKEN");
  const entry: LedgerEntry = {
    id: ledgerId,
    batchId: batch.id,
    action: "consume",
    quantity: 1,
    createdAt: now,
  };
  void reservationId;
  return { batch: next, entry };
}

export function releaseReserved(
  batch: EntitlementBatch,
  ledgerId: string,
  now: Date,
  expired: boolean,
): { batch: EntitlementBatch; entry: LedgerEntry } {
  const next: EntitlementBatch = {
    ...batch,
    quantityReserved: batch.quantityReserved - 1,
  };
  let entryAction: LedgerEntry["action"];
  if (expired) {
    next.quantityRevoked = batch.quantityRevoked + 1;
    entryAction = "revoke";
  } else {
    next.quantityAvailable = batch.quantityAvailable + 1;
    entryAction = "release";
  }
  if (!batchIdentityHolds(next)) throw new Error("ENTITLEMENT_IDENTITY_BROKEN");
  const entry: LedgerEntry = {
    id: ledgerId,
    batchId: batch.id,
    action: entryAction,
    quantity: 1,
    createdAt: now,
  };
  return { batch: next, entry };
}
