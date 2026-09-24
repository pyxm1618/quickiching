"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { describeRefundRequestResult, type RefundRequestResult } from "./refund-request-state";

type ExistingRefund = RefundRequestResult & { id: string };

export function RefundRequestControl(props: {
  orderId: string;
  orderStatus: string;
  existingRefund: ExistingRefund | null;
  locale?: "en" | "zh-Hans";
}) {
  const zh = props.locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RefundRequestResult | null>(props.existingRefund);

  const message = result ? describeRefundRequestResult(result, props.locale) : null;
  const canRequest = props.orderStatus === "paid" && !props.existingRefund && !result;

  async function submitRefundRequest() {
    const trimmed = reason.trim();
    if (!canRequest || submitting || !trimmed || trimmed.length > 1000) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/refunds", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: props.orderId, reason: trimmed }),
      });
      const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (!response.ok || !payload || typeof payload.status !== "string" || typeof payload.autoScreen !== "string") {
        throw new Error("REFUND_REQUEST_FAILED");
      }
      const next: RefundRequestResult = {
        status: payload.status,
        autoScreen: payload.autoScreen,
        screenReason: typeof payload.screenReason === "string" ? payload.screenReason : null,
      };
      setResult(next);
      setReason("");
      router.refresh();
    } catch {
      setError(t("Refund request could not be recorded. No refund has been issued; please try again.", "退款申请未能记录，也没有发出退款，请重试。"));
    } finally {
      setSubmitting(false);
    }
  }

  if (message) {
    return (
      <p className="mt-2 text-sm leading-6 text-[var(--ink-3)]" data-refund-tone={message.tone}>
        {message.message}
      </p>
    );
  }

  if (props.orderStatus !== "paid") {
    return <p className="mt-2 text-sm text-[var(--ink-3)]">{t("Refund requests are available only for completed purchases.", "只有已完成付款的订单可以申请退款。")}</p>;
  }

  return (
    <div className="mt-3 rounded-md border border-[var(--line)] p-3">
      <p className="text-sm font-medium">{t("Request a refund", "申请退款")}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--ink-3)]">
        {t("Requests must be submitted within 7 days. Submission starts review only; it does not issue a refund automatically.", "退款申请须在购买后 7 天内提交。提交只会进入审核流程，不会自动发出退款。")}
      </p>
      <label className="mt-3 block text-xs font-medium" htmlFor={`refund-reason-${props.orderId}`}>
        {t("Reason", "退款原因")}
      </label>
      <textarea
        id={`refund-reason-${props.orderId}`}
        value={reason}
        maxLength={1000}
        rows={3}
        onChange={(event) => setReason(event.target.value)}
        className="mt-1 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-sm"
        placeholder={t("Tell us why you are requesting a refund", "请说明你申请退款的原因")}
      />
      <Button
        className="mt-2"
        variant="outline"
        disabled={!reason.trim() || submitting}
        onClick={submitRefundRequest}
      >
        {submitting ? t("Submitting…", "正在提交…") : t("Submit for manual review", "提交人工审核")}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-[var(--cinnabar)]">{error}</p>}
    </div>
  );
}
