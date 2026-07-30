"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { PRODUCTS } from "@/domain/entitlements/pricing";

const TIER_FEATURES: Record<string, string[]> = {
  one: ["Any casting method", "Ten-module deep report", "Re-openable forever"],
  three: ["Any casting method", "Save about 22% per reading", "Re-openable forever"],
  five: ["Any casting method", "Lowest per-reading price", "Re-openable forever"],
};

export function PricingButtons() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  async function buy(productId: string) {
    setPending(productId);
    setError(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, turnstileToken }),
      });
      const body = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !body.checkoutUrl) {
        if (response.status === 401) router.push("/signin");
        throw new Error(body.error ?? "Checkout could not be created.");
      }
      window.location.assign(body.checkoutUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout could not be created.");
      setTurnstileToken(null);
      setPending(null);
    }
  }

  return (
    <div>
      {turnstileRequired && (
        <div className="mx-auto mb-6 max-w-sm">
          <TurnstileWidget action="checkout" onToken={setTurnstileToken} />
        </div>
      )}
      <div className="grid overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--paper-raised)] md:grid-cols-3 md:divide-x md:divide-[var(--line)]">
        {(["one", "three", "five"] as const).map((id) => {
          const product = PRODUCTS[id];
          return (
            <div key={id} className="relative border-b border-[var(--line)] p-8 text-center last:border-b-0 md:border-b-0">
              {product.badge && (
                <span className="absolute right-4 top-4 rotate-6 rounded-[3px] border-2 border-[var(--cinnabar)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--cinnabar)]">
                  {product.badge}
                </span>
              )}
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">
                {product.label}
              </p>
              <p className="mt-3 font-display text-[44px] font-medium leading-none tracking-[-0.02em]">
                ${product.unitPriceUsd.toFixed(2)}
              </p>
              <p className="mt-2 font-mono text-xs text-[var(--ink-3)]">
                {product.quantity} CREDIT{product.quantity > 1 ? "S" : ""} · ${(product.unitPriceUsd / product.quantity).toFixed(2)} / READING
              </p>
              <ul className="mt-6 space-y-2 text-[13.5px] text-[var(--ink-2)]">
                {TIER_FEATURES[id].map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
              <Button
                className="mt-7 w-full"
                disabled={pending === id || (turnstileRequired && !turnstileToken)}
                onClick={() => buy(id)}
                variant={id === "five" ? "primary" : "outline"}
              >
                {pending === id ? "Opening checkout…" : `Get ${product.quantity} credit${product.quantity > 1 ? "s" : ""}`}
              </Button>
            </div>
          );
        })}
      </div>
      {error && (
        <p className="mt-4 rounded border border-[var(--danger)] bg-[var(--danger-wash)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
