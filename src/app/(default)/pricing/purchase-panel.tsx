"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { destinationAfterPayment, rememberPendingOrder } from "@/lib/checkout/pending-intent";
import { useOrderWait } from "@/lib/checkout/use-order-wait";

/**
 * Prices, quantities and product ids are resolved on the server and handed
 * down. This component may never compute or contain an amount — it only names
 * which product the reader picked.
 */
export type PurchaseTier = {
  productKey: string;
  quantity: number;
  totalLabel: string;
  perReadingLabel: string;
  label: string;
  badge: string | null;
};

type Failure = { message: string; retryAfterSeconds?: number };

function failureFor(status: number, body: unknown): Failure {
  const code = typeof body === "object" && body !== null
    ? String((body as Record<string, unknown>).error ?? "")
    : "";

  if (status === 401) {
    return { message: "Please sign in before buying reading credits." };
  }
  if (status === 429) {
    return { message: "Too many checkout attempts. Please wait a moment before trying again." };
  }
  if (status === 409) {
    if (code === "CHECKOUT_IDEMPOTENCY_CONFLICT") {
      return { message: "This purchase is already in progress in another tab. Finish it there, or reload this page to start again." };
    }
    if (code === "CHECKOUT_EXPIRED") {
      return { message: "That checkout session expired before it was used. Please start the purchase again." };
    }
    if (code === "CHECKOUT_PROVIDER_OUTCOME_UNCERTAIN") {
      return { message: "We could not confirm whether that checkout was created. Check your account before trying again — do not assume you were charged." };
    }
    return { message: "This order has already been settled and cannot be paid again." };
  }
  if (status === 503) {
    return { message: "Checkout is temporarily unavailable. Nothing was charged; please try again shortly." };
  }
  if (status === 403) {
    return { message: "This request was rejected for security reasons. Please reload the page and try again." };
  }
  return { message: "The purchase could not be started. Nothing was charged." };
}

function retryAfterSeconds(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
}

function newRequestId(): string {
  // Matches the route's /^[A-Za-z0-9._:-]+$/ with length 16..128.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function elapsedLabel(elapsedMs: number): string {
  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export function PurchasePanel({ tiers }: { tiers: PurchaseTier[] }) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [manualCheckoutUrl, setManualCheckoutUrl] = useState<string | null>(null);

  // One idempotency key per product, reused across retries: it is the key the
  // server dedupes on, so regenerating it would create a second order.
  const requestIds = useRef(new Map<string, string>());

  const { phase, elapsedMs } = useOrderWait(orderId);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1_000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (phase === "paid") window.location.assign(destinationAfterPayment());
  }, [phase]);

  async function buy(productKey: string) {
    if (busyKey || countdown > 0) return;

    // Opened synchronously inside the click, before any await: a tab opened
    // after the await has lost the user gesture and Safari and Firefox block it.
    const tab = typeof window === "undefined" ? null : window.open("", "_blank", "noopener,noreferrer");

    setBusyKey(productKey);
    setFailure(null);
    setManualCheckoutUrl(null);

    const requestId = requestIds.current.get(productKey) ?? newRequestId();
    requestIds.current.set(productKey, requestId);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productKey, requestId }),
      });

      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (!response.ok) {
        tab?.close();
        const next = failureFor(response.status, body);
        const wait = response.status === 429 ? retryAfterSeconds(response) : undefined;
        setFailure({ ...next, retryAfterSeconds: wait });
        if (wait) setCountdown(wait);
        return;
      }

      const checkoutUrl = typeof body === "object" && body !== null
        ? String((body as Record<string, unknown>).checkoutUrl ?? "")
        : "";
      const createdOrderId = typeof body === "object" && body !== null
        ? String((body as Record<string, unknown>).orderId ?? "")
        : "";

      if (!checkoutUrl || !createdOrderId) {
        tab?.close();
        setFailure({ message: "Checkout responded in an unexpected shape. Nothing was charged." });
        return;
      }

      rememberPendingOrder(createdOrderId);
      setOrderId(createdOrderId);

      if (tab) {
        tab.location.href = checkoutUrl;
      } else {
        // The popup was blocked. Never navigate this tab silently instead —
        // that would drop the page that is waiting for the payment to settle.
        setManualCheckoutUrl(checkoutUrl);
      }
    } catch {
      tab?.close();
      setFailure({ message: "The purchase could not be started. Nothing was charged." });
    } finally {
      setBusyKey(null);
    }
  }

  const waiting = orderId !== null && (phase === "waiting" || phase === "paid");

  return (
    <div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {tiers.map((tier) => (
          <Card key={tier.productKey} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col pt-6">
              <div className="flex items-baseline justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">
                  {tier.quantity} {tier.quantity === 1 ? "reading" : "readings"}
                </p>
                {tier.badge ? (
                  <span className="rounded bg-[var(--jade)]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--jade)]">
                    {tier.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 font-display text-4xl font-medium tracking-tight">{tier.totalLabel}</p>
              <p className="mt-1 text-sm text-[var(--ink-3)]">{tier.perReadingLabel} per reading · {tier.label}</p>
              <div className="mt-6 pt-2">
                <Button
                  className="w-full"
                  variant={tier.badge === "Popular" ? "primary" : "outline"}
                  disabled={busyKey !== null || countdown > 0 || waiting}
                  onClick={() => void buy(tier.productKey)}
                >
                  {busyKey === tier.productKey ? "Opening checkout…" : "Buy"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-4 text-xs leading-6 text-[var(--ink-3)]">
        Checkout opens in a new tab and is handled by Waffo. Credits are valid for 12 months from purchase.
      </p>

      {failure ? (
        <Card className="mt-6 border-[var(--danger)]/40">
          <CardContent className="pt-6">
            <p className="text-sm leading-6">{failure.message}</p>
            {countdown > 0 ? (
              <p className="mt-2 font-mono text-xs text-[var(--ink-3)]">You can try again in {countdown}s.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {manualCheckoutUrl ? (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <p className="font-display text-lg font-medium">Your browser blocked the checkout tab</p>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
              Open it yourself to continue. Keep this page open — it is waiting for the payment to settle.
            </p>
            <a
              className="mt-3 inline-block font-semibold text-[var(--jade)] hover:underline"
              href={manualCheckoutUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open the payment page →
            </a>
          </CardContent>
        </Card>
      ) : null}

      {orderId ? (
        <Card className="mt-6">
          <CardContent className="pt-6">
            {phase === "waiting" || phase === "paid" ? (
              <>
                <p className="font-display text-lg font-medium">
                  {phase === "paid" ? "Payment confirmed — opening your reading…" : "Waiting for your payment to settle"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
                  Finish the payment in the other tab. This page checks for you and continues on its own.
                </p>
                <p className="mt-2 font-mono text-xs text-[var(--ink-3)]">Waiting {elapsedLabel(elapsedMs)}</p>
              </>
            ) : null}

            {phase === "timed_out" ? (
              <>
                <p className="font-display text-lg font-medium">Still processing</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
                  Your payment has not been confirmed yet. This is usually just a slow settlement, not a failure.
                  Check your account in a few minutes — credits appear there as soon as they land.
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
                  Your order is being checked before credits are issued. No further action is needed from you right now.
                </p>
              </>
            ) : null}

            {phase === "refunded" ? (
              <p className="text-sm leading-6">This order was refunded, so no credits were issued.</p>
            ) : null}

            {phase === "signed_out" ? (
              <p className="text-sm leading-6">
                You were signed out while waiting. <a className="font-semibold text-[var(--jade)] hover:underline" href="/signin">Sign in</a> to see the order.
              </p>
            ) : null}

            {phase === "not_found" ? (
              <p className="text-sm leading-6">
                We can no longer find that order on your account. If you completed a payment, check{" "}
                <a className="font-semibold text-[var(--jade)] hover:underline" href="/account">your account</a> before trying again.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
