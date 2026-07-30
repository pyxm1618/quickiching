import { describe, expect, it } from "vitest";
import { repo } from "@/server/repository";

function createUserReading() {
  const user = repo.createUser(`entitlement-${crypto.randomUUID()}@example.com`);
  const casting = repo.createCastingSession({
    method: "three_coin",
    scene: "career",
    interpretationGoal: "what_do_i_need_to_see_clearly",
    userId: user.id,
    anonHash: null,
    algorithmVersion: "three-coin-v1",
  });
  return { user, reading: repo.getOrCreateReading(casting.id) };
}

describe("memory entitlement repository characterization", () => {
  it("grants, reserves, consumes, and idempotently replays completion", () => {
    const { user, reading } = createUserReading();
    repo.grantEntitlement({ userId: user.id, productId: "one", quantity: 1, amountUsd: 2.99 });
    const frozen = repo.freezeForReading(reading.id, user.id, new Date());
    if (!("reservationId" in frozen)) throw new Error("expected reservation");

    expect(repo.freezeForReading(reading.id, user.id, new Date())).toEqual(frozen);
    repo.completeReadingConsume(frozen.reservationId, { coreSummary: "done" });
    repo.completeReadingConsume(frozen.reservationId, { coreSummary: "ignored replay" });

    expect(repo.getBatches(user.id)).toHaveLength(1);
    expect(repo.getBatches(user.id)[0]).toMatchObject({ quantityAvailable: 0, quantityReserved: 0, quantityConsumed: 1 });
    expect(repo.getReading(reading.id)).toMatchObject({ status: "completed", report: { coreSummary: "done" } });
  });

  it("returns unavailable without changing batch identity", () => {
    const { user, reading } = createUserReading();

    expect(repo.freezeForReading(reading.id, user.id, new Date())).toEqual({ error: "ENTITLEMENT_NOT_AVAILABLE" });
    expect(repo.getBatches(user.id)).toEqual([]);
  });

  it("creates and marks a payment order paid", () => {
    const user = repo.createUser(`order-${crypto.randomUUID()}@example.com`);
    const order = repo.createOrder({ userId: user.id, productId: "one", amountUsd: 2.99, currency: "USD", requestId: crypto.randomUUID() });

    expect(repo.getOrder(order.id)).toEqual(order);
    expect(repo.markOrderPaid(order.id, "checkout-1")).toMatchObject({ status: "paid", providerCheckoutId: "checkout-1" });
  });
});

describe("memory entitlement repository audited defects", () => {
  it.each([false, true])("never reuses a terminal reservation (expired=%s)", (expired) => {
    const { user, reading } = createUserReading();
    repo.grantEntitlement({ userId: user.id, productId: "two", quantity: 2, amountUsd: 4.99 });
    const first = repo.freezeForReading(reading.id, user.id, new Date());
    if (!("reservationId" in first)) throw new Error("expected first reservation");
    repo.releaseReading(first.reservationId, expired);

    const retry = repo.freezeForReading(reading.id, user.id, new Date());

    expect(retry).toHaveProperty("reservationId");
    expect((retry as { reservationId: string }).reservationId).not.toBe(first.reservationId);
  });
});
