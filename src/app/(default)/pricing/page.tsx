import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCTS, formatUsd, perReadingUsd, type ProductId } from "@/domain/entitlements/pricing";
import { isCheckoutCapabilityEnabled } from "@/server/payments/capability";
import { PurchasePanel, type PurchaseTier } from "./purchase-panel";

export const metadata: Metadata = {
  title: "Planned Commercial Features",
  description: "Status of future personalized AI deep readings. No payment or checkout is active in Public V1.",
  alternates: { canonical: "/pricing" },
  robots: { index: false, follow: true },
};

const TIER_ORDER: ProductId[] = ["one", "three", "five"];

// Whether this page offers anything for sale depends on a server capability.
// Prerendering would freeze that decision at build time, so a flag flipped off
// afterwards would keep serving a live purchase UI until the next deploy.
export const dynamic = "force-dynamic";

/**
 * Every number shown comes from the server-side product table. The client
 * component receives finished labels and a product key; it never sees a unit
 * price it could recompute or a quantity it could alter.
 */
function tiers(): PurchaseTier[] {
  return TIER_ORDER.map((id) => {
    const product = PRODUCTS[id];
    return {
      productKey: product.id,
      quantity: product.quantity,
      totalLabel: formatUsd(product.unitPriceUsd),
      perReadingLabel: perReadingUsd(product),
      label: product.label,
      badge: product.badge,
    };
  });
}

/** The Public V1 notice. Unchanged, and still what visitors see while checkout is closed. */
function NotOnSale() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Commercial V2 · Not active</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">Personalized deep readings are not on sale</h1>
      <p className="mt-5 text-lg leading-8 text-[var(--ink-2)]">Public V1 already includes complete free casting and a static hexagram interpretation for Three Coin, Yarrow Stalk, Mei Hua Yi Shu, and Manual Cast. There is currently no production checkout, credit purchase, account requirement, or paid AI deep-reading service.</p>
      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-6 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--ink)]">Future boundary:</strong> a Commercial V2 may add an optional personalized deep reading that uses a user’s specific situation and goal. Pricing and purchase terms will be published only when that service is actually available.</div>
      <p className="mt-8 text-sm leading-7 text-[var(--ink-2)]"><Link href="/" className="font-semibold text-[var(--jade)] hover:underline">Return to the free I Ching online reading</Link>.</p>
    </section>
  );
}

export default function PricingPage() {
  if (!isCheckoutCapabilityEnabled()) return <NotOnSale />;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Deep readings</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">Buy reading credits</h1>
      <p className="mt-5 text-lg leading-8 text-[var(--ink-2)]">
        Casting and the free interpretation stay free and need no account. A credit buys one personalized deep
        reading of a cast you have already made: the classical judgement, change rules and line positions are
        derived by our own rules, and the interpretation is written around your question.
      </p>

      <PurchasePanel tiers={tiers()} />

      <p className="mt-8 text-sm leading-7 text-[var(--ink-2)]">
        <Link href="/" className="font-semibold text-[var(--jade)] hover:underline">Return to the free I Ching online reading</Link>.
      </p>
    </section>
  );
}
