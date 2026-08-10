import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Help & Support",
  description: "Help for Quick I Ching Public V1 casting methods and browser-session readings.",
  alternates: { canonical: "/help" },
  robots: { index: false, follow: true },
};

export default function HelpPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Support</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">Help & Support</h1>

      <h2 className="mt-10 font-display text-2xl font-medium">Are the three readings really free?</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Yes. Three Coin, Yarrow Stalk, and Mei Hua Yi Shu current-time casting each end with the primary hexagram, changing lines, relating hexagram when present, and a general basic interpretation. No sign-in or payment is required.</p>
      <h2 className="mt-10 font-display text-2xl font-medium">Where is my reading saved?</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Public V1 uses browser <code>sessionStorage</code> for the current reading or in-progress ritual. It is not a cloud account history. Clearing site/session data removes that local progress.</p>
      <h2 className="mt-10 font-display text-2xl font-medium">Why does Mei Hua ask for a timezone?</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">The current-time convention needs a local civil date and hour branch. Your IANA timezone tells the browser which local date, hour, and daylight-saving offset apply to the fixed casting instant.</p>
      <h2 className="mt-10 font-display text-2xl font-medium">Can I buy a personalized AI reading?</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Not in Public V1. Production AI, accounts, payment, credits, and saved history belong to a future Commercial V2 and are intentionally not enabled for the indexing launch.</p>
      <h2 className="mt-10 font-display text-2xl font-medium">Need more help?</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Email support@quickiching.com. For reading concepts, see <Link href="/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">Changing Lines</Link> and <Link href="/guides/primary-relating-hexagrams" className="font-semibold text-[var(--jade)] hover:underline">Primary & Relating Hexagrams</Link>.</p>
    </article>
  );
}
