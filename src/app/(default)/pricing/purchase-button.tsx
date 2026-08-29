"use client";

import { useState } from "react";
import type { ProductId } from "@/domain/entitlements/pricing";

export function PurchaseButton({ productKey }: { productKey: ProductId }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function beginCheckout() {
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productKey,
          requestId: crypto.randomUUID(),
        }),
      });

      if (response.status === 401) {
        window.location.assign("/signin?callbackURL=%2Fpricing");
        return;
      }

      const body = await response.json().catch(() => null) as {
        checkoutUrl?: unknown;
        error?: unknown;
      } | null;

      if (!response.ok || typeof body?.checkoutUrl !== "string") {
        setError(response.status === 429
          ? "Too many checkout attempts. Please try again shortly."
          : "Checkout is temporarily unavailable. Please try again.");
        return;
      }

      const checkoutUrl = new URL(body.checkoutUrl);
      if (checkoutUrl.protocol !== "https:") {
        setError("Checkout is temporarily unavailable. Please try again.");
        return;
      }
      window.location.assign(checkoutUrl.toString());
    } catch {
      setError("Checkout is temporarily unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={beginCheckout}
        disabled={pending}
        className="w-full rounded-lg bg-[var(--jade)] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Opening secure checkout…" : "Buy reading credits"}
      </button>
      {error ? <p className="mt-2 text-xs leading-5 text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
