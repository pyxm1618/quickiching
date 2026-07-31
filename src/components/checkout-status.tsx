"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

type OrderStatus = "pending" | "paid" | "partially_refunded" | "refunded" | "disputed";

type OrderSnapshot = {
  orderId: string;
  productId: string;
  amountUsd: number;
  currency: string;
  status: OrderStatus;
  financialReviewRequired: boolean;
  updatedAt: string;
};

const TERMINAL = new Set<OrderStatus>(["paid", "partially_refunded", "refunded", "disputed"]);
const MAX_ATTEMPTS = 40;
const POLL_MS = 1500;
const primaryLink = "inline-flex h-11 items-center justify-center rounded bg-[var(--cinnabar)] px-5 text-[15px] font-semibold text-[var(--primary-foreground)] transition-all hover:-translate-y-px hover:bg-[var(--cinnabar-deep)]";
const outlineLink = "inline-flex h-11 items-center justify-center rounded border border-[var(--line-strong)] px-5 text-[15px] font-semibold text-[var(--ink)] transition-all hover:bg-[var(--ink)]/5";

function copyFor(snapshot: OrderSnapshot | null, error: string | null) {
  if (error) return { title: "We could not verify this order", body: error };
  switch (snapshot?.status) {
    case "paid":
      return { title: "Payment confirmed", body: "Your reading credits are now available in your account." };
    case "partially_refunded":
      return { title: "Order partially refunded", body: "The available credits were adjusted from the provider refund event." };
    case "refunded":
      return { title: "Order refunded", body: "Available credits from this order have been revoked." };
    case "disputed":
      return { title: "Order disputed", body: "Available credits from this order have been revoked while the dispute is reviewed." };
    default:
      return { title: "Confirming payment", body: "The checkout redirect is not treated as proof of payment. This page is waiting for the signed provider webhook." };
  }
}

export function CheckoutStatus({ orderId }: { orderId: string }) {
  const [snapshot, setSnapshot] = useState<OrderSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      for (let attempt = 0; attempt < MAX_ATTEMPTS && !cancelled; attempt++) {
        try {
          const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (response.status === 401) {
            setError("Sign in again to review the order status.");
            return;
          }
          if (response.status === 404) {
            setError("This order is not available for the signed-in account.");
            return;
          }
          if (!response.ok) throw new Error("ORDER_STATUS_UNAVAILABLE");
          const next = await response.json() as OrderSnapshot;
          if (cancelled) return;
          setSnapshot(next);
          if (TERMINAL.has(next.status)) return;
        } catch {
          if (attempt === MAX_ATTEMPTS - 1) {
            setError("Payment confirmation is delayed. The order remains in your account and can be checked again later.");
            return;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
    }
    void poll();
    return () => { cancelled = true; };
  }, [orderId]);

  const copy = copyFor(snapshot, error);
  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="py-10 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--bronze)]">
          Order {orderId}
        </p>
        <h1 className="mt-3 font-display text-3xl font-medium">{copy.title}</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[var(--ink-2)]">{copy.body}</p>
        {snapshot?.financialReviewRequired && (
          <p className="mt-4 rounded border border-[var(--danger)] bg-[var(--danger-wash)] px-4 py-3 text-sm text-[var(--danger)]">
            This order requires manual financial review because some credits had already been used or reserved.
          </p>
        )}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/account" className={primaryLink}>Open account</Link>
          <Link href="/pricing" className={outlineLink}>Back to pricing</Link>
        </div>
      </CardContent>
    </Card>
  );
}
