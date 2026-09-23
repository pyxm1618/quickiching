export type RefundRequestResult = {
  status: string;
  autoScreen: string;
  screenReason: string | null;
};

export type RefundRequestMessage = {
  tone: "pending" | "review" | "rejected" | "unknown";
  message: string;
};

export function describeRefundRequestResult(result: RefundRequestResult, locale: "en" | "zh-Hans" = "en"): RefundRequestMessage {
  const zh = locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  if (result.status === "manual_review" && result.autoScreen === "clear") {
    return {
      tone: "pending",
      message: t("Refund request submitted for manual review. No refund has been issued yet.", "退款申请已提交人工审核，目前尚未发出退款。"),
    };
  }
  if (
    result.status === "manual_review"
    && result.autoScreen === "manual_exception"
    && result.screenReason === "REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE"
  ) {
    return {
      tone: "review",
      message: t("Refund request requires manual review because the purchased credits are no longer fully available. No refund has been issued.", "由于购买的解读次数已不再全部可用，这笔退款申请需要人工审核，目前尚未发出退款。"),
    };
  }
  if (result.status === "rejected" && result.screenReason === "REFUND_WINDOW_EXPIRED") {
    return {
      tone: "rejected",
      message: t("This refund request is outside the 7-day request window and was not approved.", "这笔退款申请已超过 7 天申请期限，因此未获批准。"),
    };
  }
  return {
    tone: "unknown",
    message: t("Refund request status is available for manual review. No refund is assumed from this page.", "退款申请状态需要人工审核；本页面不会据此假设已经退款。"),
  };
}
