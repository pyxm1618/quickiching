"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createCheckoutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { PRODUCTS } from "@/domain/entitlements/pricing";

/** 账册式定价（phototype/UI设计方案.md §6.4）：三栏并列，印章批注，mono 折算。 */

const TIER_FEATURES: Record<string, string[]> = {
  one: ["Any casting method", "Ten-module deep report", "Re-openable forever"],
  three: ["Any casting method", "Save about 22% per reading", "Re-openable forever"],
  five: ["Any casting method", "Lowest per-reading price", "Re-openable forever"],
};

export function PricingButtons() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(productId: string) {
    setPending(productId);
    setError(null);
    const res = await createCheckoutAction({ productId });
    if (!res.ok) {
      setError(res.error.message);
      if (res.error.code === "AUTH_REQUIRED") router.push("/signin");
      setPending(null);
      return;
    }
    router.push(res.value.checkoutUrl);
  }

  return (
    <div>
      <div className="grid overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--paper-raised)] md:grid-cols-3 md:divide-x md:divide-[var(--line)]">
        {(["one", "three", "five"] as const).map((id) => {
          const p = PRODUCTS[id];
          return (
            <div key={id} className="relative border-b border-[var(--line)] p-8 text-center last:border-b-0 md:border-b-0">
              {p.badge && (
                <span className="absolute right-4 top-4 rotate-6 rounded-[3px] border-2 border-[var(--cinnabar)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--cinnabar)]">
                  {p.badge}
                </span>
              )}
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">
                {p.label}
              </p>
              <p className="mt-3 font-display text-[44px] font-medium leading-none tracking-[-0.02em]">
                ${p.unitPriceUsd.toFixed(2)}
              </p>
              <p className="mt-2 font-mono text-xs text-[var(--ink-3)]">
                {p.quantity} CREDIT{p.quantity > 1 ? "S" : ""} · ${(p.unitPriceUsd / p.quantity).toFixed(2)} / READING
              </p>
              <ul className="mt-6 space-y-2 text-[13.5px] text-[var(--ink-2)]">
                {TIER_FEATURES[id].map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Button
                className="mt-7 w-full"
                disabled={pending === id}
                onClick={() => buy(id)}
                variant={id === "five" ? "primary" : "outline"}
              >
                {pending === id ? "Opening checkout…" : `Get ${p.quantity} credit${p.quantity > 1 ? "s" : ""}`}
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
