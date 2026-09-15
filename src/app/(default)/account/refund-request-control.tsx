"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { describeRefundRequestResult, type RefundRequestResult } from "./refund-request-state";

type ExistingRefund = RefundRequestResult & { id: string };

export function RefundRequestControl(props: {
  orderId: string;
  orderStatus: string;
  existingRefund: ExistingRefund | null;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RefundRequestResult | null>(props.existingRefund);

  const message = result ? describeRefundRequestResult(result) : null;
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
      setError("Refund request could not be recorded. No refund has been issued; please try again.");
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
    return <p className="mt-2 text-sm text-[var(--ink-3)]">Refund requests are available only for completed purchases.</p>;
  }

  return (
    <div className="mt-3 rounded-md border border-[var(--line)] p-3">
      <p className="text-sm font-medium">Request a refund</p>
      <p className="mt-1 text-xs leading-5 text-[var(--ink-3)]">
        Requests must be submitted within 7 days. Submission starts review only; it does not issue a refund automatically.
      </p>
      <label className="mt-3 block text-xs font-medium" htmlFor={`refund-reason-${props.orderId}`}>
        Reason
      </label>
      <textarea
        id={`refund-reason-${props.orderId}`}
        value={reason}
        maxLength={1000}
        rows={3}
        onChange={(event) => setReason(event.target.value)}
        className="mt-1 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-sm"
        placeholder="Tell us why you are requesting a refund"
      />
      <Button
        className="mt-2"
        variant="outline"
        disabled={!reason.trim() || submitting}
        onClick={submitRefundRequest}
      >
        {submitting ? "Submitting…" : "Submit for manual review"}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-[var(--cinnabar)]">{error}</p>}
    </div>
  );
}
