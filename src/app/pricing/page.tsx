import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Planned Commercial Features",
  description: "Status of future personalized AI deep readings. No payment or checkout is active in Public V1.",
  alternates: { canonical: "/pricing" },
  robots: { index: false, follow: true },
};

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Commercial V2 · Not active</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">Personalized deep readings are not on sale</h1>
      <p className="mt-5 text-lg leading-8 text-[var(--ink-2)]">Public V1 already includes complete free casting and a basic hexagram interpretation for Three Coin, Yarrow Stalk, and Mei Hua Yi Shu. There is currently no production checkout, credit purchase, account requirement, or paid AI deep-reading service.</p>
      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-6 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--ink)]">Future boundary:</strong> a Commercial V2 may add an optional personalized deep reading that uses a user’s specific situation and goal. Pricing and purchase terms will be published only when that service is actually available.</div>
      <p className="mt-8 text-sm leading-7 text-[var(--ink-2)]"><Link href="/" className="font-semibold text-[var(--jade)] hover:underline">Return to the free I Ching online reading</Link>.</p>
    </section>
  );
}
