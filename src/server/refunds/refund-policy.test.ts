import { describe, expect, it } from "vitest";
import { screenRefundApplication } from "./refund-policy";

const paidAt = new Date("2026-09-01T00:00:00.000Z");

describe("Quick I Ching refund application policy", () => {
  it("accepts an application through the seven-day boundary", () => {
    expect(screenRefundApplication({
      paidAt,
      now: new Date("2026-09-08T00:00:00.000Z"),
      orderStatus: "paid",
      quantityTotal: 3,
      quantityAvailable: 3,
      quantityReserved: 0,
      quantityConsumed: 0,
      quantityRevoked: 0,
    })).toEqual({ eligible: true, autoScreen: "clear", reasonCode: null });
  });

  it("rejects an application after seven days", () => {
    expect(screenRefundApplication({
      paidAt,
      now: new Date("2026-09-08T00:00:00.001Z"),
      orderStatus: "paid",
      quantityTotal: 1,
      quantityAvailable: 1,
      quantityReserved: 0,
      quantityConsumed: 0,
      quantityRevoked: 0,
    })).toEqual({ eligible: false, autoScreen: "rejected", reasonCode: "REFUND_WINDOW_EXPIRED" });
  });

  it("keeps partially consumed purchases in manual exception review without inventing a prorated refund", () => {
    expect(screenRefundApplication({
      paidAt,
      now: new Date("2026-09-03T00:00:00.000Z"),
      orderStatus: "paid",
      quantityTotal: 3,
      quantityAvailable: 2,
      quantityReserved: 0,
      quantityConsumed: 1,
      quantityRevoked: 0,
    })).toEqual({
      eligible: true,
      autoScreen: "manual_exception",
      reasonCode: "REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE",
    });
  });

  it("keeps reserved credits in manual exception review", () => {
    expect(screenRefundApplication({
      paidAt,
      now: new Date("2026-09-03T00:00:00.000Z"),
      orderStatus: "paid",
      quantityTotal: 5,
      quantityAvailable: 4,
      quantityReserved: 1,
      quantityConsumed: 0,
      quantityRevoked: 0,
    })).toMatchObject({ eligible: true, autoScreen: "manual_exception" });
  });

  it("rejects orders that are not currently paid", () => {
    expect(screenRefundApplication({
      paidAt,
      now: new Date("2026-09-03T00:00:00.000Z"),
      orderStatus: "refunded",
      quantityTotal: 1,
      quantityAvailable: 0,
      quantityReserved: 0,
      quantityConsumed: 0,
      quantityRevoked: 1,
    })).toEqual({ eligible: false, autoScreen: "rejected", reasonCode: "REFUND_ORDER_NOT_PAID" });
  });
});
