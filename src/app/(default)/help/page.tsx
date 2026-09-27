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

      <h2 className="mt-10 font-display text-2xl font-medium">Are the four readings really free?</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Yes. Three Coin, Yarrow Stalk, Mei Hua Yi Shu current-time casting, and Manual Cast each end with the primary hexagram, changing lines, relating hexagram when present, and a general static interpretation. No sign-in or payment is required.</p>
      <h2 className="mt-10 font-display text-2xl font-medium">Where is my reading saved?</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Public V1 uses browser <code>sessionStorage</code> for the current reading or in-progress ritual. If you choose Save reading, the History page stores a maximum of 50 records in this browser’s <code>localStorage</code>; it is not a cloud account history. Clearing site/session data removes local records.</p>
      <h2 className="mt-10 font-display text-2xl font-medium">Why does Mei Hua ask for a timezone?</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">The current-time convention needs a local civil date and hour branch. Your IANA timezone tells the browser which local date, hour, and daylight-saving offset apply to the fixed casting instant.</p>
      <h2 className="mt-10 font-display text-2xl font-medium">Can I get a reading for my specific situation?</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">The complete free reading explains the cast itself and never calls AI. Deep Reading is offered only when Pricing shows it is available, and supports Three-Coin casts. It requires sign-in, a clear core question set before the first toss, enough situation context, and one credit. It connects that frozen question and your context with the exact cast, its actual changing lines and relating hexagram when present, and cited Quick I Ching source material. If you skipped the question, that cast remains free-only; start a new cast to use Deep Reading. High-risk medical, legal, investment, or urgent safety requests are blocked before generation. A delivered report is saved in account history.</p>
      <h2 className="mt-10 font-display text-2xl font-medium">How do credit packs and refunds work?</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Checkout requires sign-in and shows the price, validity, and applicable refund terms before payment. One credit is reserved when an eligible Deep Reading starts; successful delivery consumes it. If generation or review fails after reservation, the credit is released. A request blocked before generation does not create a paid reading job.</p>
      <h2 className="mt-10 font-display text-2xl font-medium">Need more help?</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Email support@quickiching.com. For reading concepts, see <Link href="/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">Changing Lines</Link> and <Link href="/guides/primary-relating-hexagrams" className="font-semibold text-[var(--jade)] hover:underline">Primary & Relating Hexagrams</Link>.</p>
    </article>
  );
}
