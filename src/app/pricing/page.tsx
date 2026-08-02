import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Planned Quick I Ching credit-pack pricing. Payments are temporarily unavailable.",
  alternates: { canonical: "/pricing" },
};

const PACKS = [
  { name: "Single reading", credits: 1, price: "$2.99", note: "One detailed reading credit" },
  { name: "Three readings", credits: 3, price: "$6.99", note: "Three reusable reading credits" },
  { name: "Five readings", credits: 5, price: "$9.99", note: "Five reusable reading credits" },
] as const;

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--bronze)]">Transparent pricing</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">Planned credit packs</h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[var(--ink-2)]">
        One credit is intended to unlock one saved, detailed interpretation after the production service is released. The free browser coin-casting preview does not require a credit.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {PACKS.map((pack) => (
          <article key={pack.credits} className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-7">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--bronze)]">{pack.credits} credit{pack.credits > 1 ? "s" : ""}</p>
            <h2 className="mt-3 font-display text-2xl font-medium">{pack.name}</h2>
            <p className="mt-5 text-4xl font-semibold tracking-tight">{pack.price}</p>
            <p className="mt-3 min-h-12 text-sm leading-6 text-[var(--ink-3)]">{pack.note}</p>
            <button type="button" disabled className="mt-7 w-full cursor-not-allowed rounded-md border border-[var(--line-strong)] px-4 py-3 text-sm font-semibold text-[var(--ink-3)] opacity-70">
              Payments not yet available
            </button>
          </article>
        ))}
      </div>
      <div className="mt-10 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-6 text-sm leading-7 text-[var(--ink-2)]">
        No checkout is active and this site cannot charge a card. Refund, fulfilment, and payment terms will apply only after the payment service is enabled. Questions may be sent to <a href="mailto:support@quickiching.com" className="font-semibold text-[var(--jade)] underline underline-offset-4">support@quickiching.com</a>.
      </div>
    </section>
  );
}
