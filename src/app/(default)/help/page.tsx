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
      <h2 className="mt-10 font-display text-2xl font-medium">Can I use a personalized AI reading?</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Yes. When signed in with available reading credits, you can request an optional personalized Deep Reading tailored to your casting and question. A credit is only consumed once the reading is successfully generated and delivered; if generation fails, the credit reservation is released.</p>
      <h2 className="mt-10 font-display text-2xl font-medium">How do credit packs and refunds work?</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Reading credits are one-time packs (1, 3, or 5 readings; not recurring subscriptions) processed securely via Waffo. You can submit a refund request within 7 days of purchase through My Account or by contacting support@quickiching.com. Requests are reviewed under established criteria: technical delivery failures, structural omissions, citation errors, or failure to address the submitted question are valid grounds, while subjective dissatisfaction with an interpretive reflection does not qualify for an automatic refund.</p>
      <h2 className="mt-10 font-display text-2xl font-medium">Need more help?</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Email support@quickiching.com. For reading concepts, see <Link href="/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">Changing Lines</Link> and <Link href="/guides/primary-relating-hexagrams" className="font-semibold text-[var(--jade)] hover:underline">Primary & Relating Hexagrams</Link>.</p>
    </article>
  );
}
