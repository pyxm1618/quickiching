export type RefundRequestResult = {
  status: string;
  autoScreen: string;
  screenReason: string | null;
};

export type RefundRequestMessage = {
  tone: "pending" | "review" | "rejected" | "unknown";
  message: string;
};

export function describeRefundRequestResult(result: RefundRequestResult): RefundRequestMessage {
  if (result.status === "manual_review" && result.autoScreen === "clear") {
    return {
      tone: "pending",
      message: "Refund request submitted for manual review. No refund has been issued yet.",
    };
  }
  if (
    result.status === "manual_review"
    && result.autoScreen === "manual_exception"
    && result.screenReason === "REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE"
  ) {
    return {
      tone: "review",
      message: "Refund request requires manual review because the purchased credits are no longer fully available. No refund has been issued.",
    };
  }
  if (result.status === "rejected" && result.screenReason === "REFUND_WINDOW_EXPIRED") {
    return {
      tone: "rejected",
      message: "This refund request is outside the 7-day request window and was not approved.",
    };
  }
  return {
    tone: "unknown",
    message: "Refund request status is available for manual review. No refund is assumed from this page.",
  };
}
