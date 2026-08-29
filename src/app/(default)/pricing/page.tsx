import type { Metadata } from "next";
import Link from "next/link";
import { isCheckoutCapabilityEnabled } from "@/server/payments/capability";
import { buildPricingView } from "./pricing-model";
import { PurchaseButton } from "./purchase-button";

export const metadata: Metadata = {
  title: "Deep Reading Credits | Quick I Ching",
  description: "Pricing and availability for optional personalized I Ching deep-reading credits.",
  alternates: { canonical: "/pricing" },
  robots: { index: false, follow: true },
};

// Commercial capability flags are deployment-time server configuration.
export const dynamic = "force-dynamic";

export default function PricingPage() {
  const pricing = buildPricingView(isCheckoutCapabilityEnabled());

  if (!pricing.enabled) {
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

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Personalized Deep Reading</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">Choose a reading credit pack</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">
        Your free casting and hexagram result remain available without purchase. Credits are only for the optional personalized Deep Reading generated from your revealed casting, question context, and interpretation goal.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {pricing.products.map((product) => (
          <article key={product.id} className="relative rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-6">
            {product.badge ? (
              <p className="mb-3 inline-flex rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--bronze)]">{product.badge}</p>
            ) : null}
            <h2 className="font-display text-2xl font-medium">{product.quantity} {product.quantity === 1 ? "reading" : "readings"}</h2>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{product.total}</p>
            <p className="mt-1 text-sm text-[var(--ink-3)]">{product.perReading} per reading · USD</p>
            <p className="mt-4 min-h-6 text-sm font-medium text-[var(--ink-2)]">{product.label}</p>
            <PurchaseButton productKey={product.id} />
          </article>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-6 text-sm leading-7 text-[var(--ink-2)]">
        Credits are valid for 12 months from successful payment. Checkout requires sign-in. A credit is reserved when a paid Deep Reading starts and is consumed only after the reading is successfully delivered; failed or blocked generation releases the reservation.
      </div>
      <p className="mt-8 text-sm leading-7 text-[var(--ink-2)]"><Link href="/" className="font-semibold text-[var(--jade)] hover:underline">Return to the free I Ching online reading</Link>.</p>
    </section>
  );
}
