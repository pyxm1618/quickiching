"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { destinationAfterPayment, readPendingOrder } from "@/lib/checkout/pending-intent";
import { useOrderWait } from "@/lib/checkout/use-order-wait";

function elapsedLabel(elapsedMs: number): string {
  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

/**
 * Waffo sends the buyer here after a successful payment. The order identity
 * comes from this browser's own record of what it started — never from the
 * return URL, whose contents are outside our control and reachable by anyone.
 *
 * In the usual flow the tab that started the purchase is still open and doing
 * this same wait, so this page is a courtesy: it says the payment went through
 * and points back. It only takes over the waiting when that tab is gone.
 */
export function CheckoutReturn() {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    setOrderId(readPendingOrder());
    setResolved(true);
  }, []);

  const { phase, elapsedMs } = useOrderWait(orderId);

  useEffect(() => {
    if (phase === "paid") window.location.assign(destinationAfterPayment());
  }, [phase]);

  if (!resolved) {
    return (
      <Card className="mt-8"><CardContent className="pt-6">
        <p className="text-sm leading-6 text-[var(--ink-2)]">Checking your order…</p>
      </CardContent></Card>
    );
  }

  if (!orderId) {
    return (
      <Card className="mt-8"><CardContent className="pt-6">
        <p className="font-display text-lg font-medium">Thanks — you can close this tab</p>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
          This tab has no record of which order you just paid for, which is normal if you started the
          purchase in a different tab, window or device. If the tab you bought from is still open, it is
          already waiting for you there.
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
          Otherwise your credits will appear on your account as soon as the payment settles.
        </p>
        <a className="mt-3 inline-block font-semibold text-[var(--jade)] hover:underline" href="/account">
          Go to my account →
        </a>
      </CardContent></Card>
    );
  }

  return (
    <Card className="mt-8"><CardContent className="pt-6">
      {phase === "waiting" || phase === "paid" ? (
        <>
          <p className="font-display text-lg font-medium">
            {phase === "paid" ? "Payment confirmed — opening your reading…" : "Confirming your payment"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
            Payment providers confirm in the background, so this can take a moment. You can leave this page
            open; it continues on its own.
          </p>
          <p className="mt-2 font-mono text-xs text-[var(--ink-3)]">Waiting {elapsedLabel(elapsedMs)}</p>
        </>
      ) : null}

      {phase === "timed_out" ? (
        <>
          <p className="font-display text-lg font-medium">Still processing</p>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
            Your payment has not been confirmed yet. This is usually a slow settlement rather than a failure.
            Check back in a few minutes — credits appear on your account as soon as they land.
          </p>
          <a className="mt-3 inline-block font-semibold text-[var(--jade)] hover:underline" href="/account">
            Go to my account →
          </a>
        </>
      ) : null}

      {phase === "review" ? (
        <>
          <p className="font-display text-lg font-medium">This payment is under review</p>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
            Your order is being checked before credits are issued. Nothing further is needed from you right now.
          </p>
        </>
      ) : null}

      {phase === "refunded" ? (
        <p className="text-sm leading-6">This order was refunded, so no credits were issued.</p>
      ) : null}

      {phase === "signed_out" ? (
        <p className="text-sm leading-6">
          You were signed out while waiting.{" "}
          <a className="font-semibold text-[var(--jade)] hover:underline" href="/signin">Sign in</a> to see the order.
        </p>
      ) : null}

      {phase === "not_found" ? (
        <p className="text-sm leading-6">
          We can no longer find that order on your account. If you completed a payment, check{" "}
          <a className="font-semibold text-[var(--jade)] hover:underline" href="/account">your account</a> before
          trying again — do not pay a second time.
        </p>
      ) : null}
    </CardContent></Card>
  );
}
