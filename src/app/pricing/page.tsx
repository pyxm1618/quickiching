import type { Metadata } from "next";
import { PricingButtons } from "@/components/pricing-buttons";
import { loadEntitlementBalance } from "@/server/loaders";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple reading credits: 1, 3, or 5 deep readings. One price, no subscriptions.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const balance = await loadEntitlementBalance();
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-center">
      <p className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-[var(--bronze)]">
        Reading Credits · 解读权益
      </p>
      <h1 className="mt-4 font-display text-[clamp(1.9rem,3vw,2.6rem)] font-medium tracking-[-0.015em]">
        One reading, kept forever.
      </h1>
      <p className="mx-auto mt-4 max-w-xl leading-relaxed text-[var(--ink-2)]">
        The basic hexagram result is always free. A deep reading is a fixed, re-openable report
        written for your specific situation. Credits are valid for 12 months from purchase and are
        never tied to a single hexagram.
      </p>

      {balance.available > 0 && (
        <p className="mx-auto mt-6 w-fit rounded bg-[var(--jade-wash)] px-4 py-2 font-mono text-xs tracking-[0.04em] text-[var(--jade)]">
          {balance.available} credit{balance.available > 1 ? "s" : ""} available in your account
        </p>
      )}

      <div className="mt-12 text-left">
        <PricingButtons />
      </div>

      <p className="mt-8 font-mono text-[11px] leading-relaxed tracking-[0.06em] text-[var(--ink-3)]">
        VALID 12 MONTHS FROM PURCHASE · EARLIEST-EXPIRING CREDIT USED FIRST · NO COUNTDOWN, NO FALSE
        URGENCY · USD, TAXES SHOWN BEFORE PAYMENT · DEMO CHECKOUT — NO REAL CHARGE
      </p>
    </div>
  );
}
