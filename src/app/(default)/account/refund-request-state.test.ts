import { describe, expect, it } from "vitest";
import { describeRefundRequestResult } from "./refund-request-state";

describe("account refund request messaging", () => {
  it("makes clear that a submitted request is not an automatic refund", () => {
    expect(describeRefundRequestResult({
      status: "manual_review",
      autoScreen: "clear",
      screenReason: null,
    })).toEqual({
      tone: "pending",
      message: "Refund request submitted for manual review. No refund has been issued yet.",
    });
  });

  it("surfaces manual exceptions without promising a refund", () => {
    expect(describeRefundRequestResult({
      status: "manual_review",
      autoScreen: "manual_exception",
      screenReason: "REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE",
    })).toEqual({
      tone: "review",
      message: "Refund request requires manual review because the purchased credits are no longer fully available. No refund has been issued.",
    });
  });

  it("surfaces rejected applications without provider-write language", () => {
    expect(describeRefundRequestResult({
      status: "rejected",
      autoScreen: "rejected",
      screenReason: "REFUND_WINDOW_EXPIRED",
    })).toEqual({
      tone: "rejected",
      message: "This refund request is outside the 7-day request window and was not approved.",
    });
  });
});
