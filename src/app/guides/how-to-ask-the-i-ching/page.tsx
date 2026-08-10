import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to Ask the I Ching — Practical Question Guide",
  description: "Learn how to frame a clear I Ching question for reflection without forcing a yes/no prediction or handing over your decision-making.",
  alternates: { canonical: "/guides/how-to-ask-the-i-ching" },
  openGraph: { title: "How to Ask the I Ching — Practical Question Guide", description: "A practical guide to asking one clear, reflective I Ching question.", url: "/guides/how-to-ask-the-i-ching", type: "article" },
};

export default function HowToAskGuidePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">I Ching Guide</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">How to Ask the I Ching</h1>
      <p className="mt-5 text-lg leading-8 text-[var(--ink-2)]">A useful I Ching question gives reflection a clear subject without demanding that the hexagram make the decision for you.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Ask about one situation</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Keep one main concern in view. Instead of combining a job change, relationship problem, and financial decision into one cast, choose the situation you actually need to understand first.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Prefer reflective questions to forced certainty</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Questions such as “What should I understand about this transition?” or “What conditions deserve attention before I act?” leave room to compare the reading with real evidence. A question like “Will this definitely succeed?” asks for certainty the I Ching cannot responsibly provide.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Work with the first result</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Repeated casting until a preferred answer appears weakens the reflective value of the process. Read the primary hexagram, changing lines, and relating hexagram first; cast again later only when the situation or the question has genuinely changed.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Keep professional decisions grounded in professional evidence</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Do not use a reading to replace medical treatment advice, legal counsel, financial advice, emergency guidance, or other professional judgment. The reading can be a cultural and reflective framework while the actual decision remains grounded in appropriate expertise and evidence.</p>

      <nav className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-[var(--line)] pt-6 text-sm" aria-label="Related guides"><Link href="/" className="font-semibold text-[var(--jade)] hover:underline">Start an I Ching online reading</Link><Link href="/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">Understanding changing lines</Link><Link href="/methods/three-coin" className="font-semibold text-[var(--jade)] hover:underline">Three-coin method</Link></nav>
    </article>
  );
}
