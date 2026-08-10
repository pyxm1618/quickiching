import type { Metadata } from "next";
import Link from "next/link";
import { YarrowTool } from "@/components/public-reading/yarrow-tool";

export const metadata: Metadata = {
  title: "I Ching Yarrow Stalk Method — Free Online Casting",
  description: "Use the I Ching yarrow stalk method online with 49-stalk arithmetic, 18 recorded changes, changing lines, and a free basic hexagram interpretation.",
  alternates: { canonical: "/methods/yarrow-stalks" },
  openGraph: { title: "I Ching Yarrow Stalk Method — Free Online Casting", description: "Complete a free 49-stalk yarrow I Ching casting online.", url: "/methods/yarrow-stalks", type: "website" },
};

export default function YarrowStalksPage() {
  return (
    <article>
      <header className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Yarrow I Ching · 49 Stalks</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">I Ching Yarrow Stalk Method</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">The yarrow stalk method forms each line through three changes. Quick I Ching makes all eighteen changes visible and resumable in your browser instead of replacing the ritual with a single random button.</p>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-12"><YarrowTool /></section>

      <section className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-2">
        <div><h2 className="font-display text-2xl font-medium">The 49-stalk procedure used here</h2><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">A change records a valid split of the working stalks, one stalk taken from the right, and the remainders after counting the left and right groups by fours. After three changes, the remaining count divided by four gives a line value of 6, 7, 8, or 9.</p><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Quick I Ching's digital convention explicitly samples the conventional Zhu Xi-style change outcomes: the first change removes 5 or 9 with 3:1 weighting; the next two remove 4 or 8 equally. This yields line probabilities 1/16, 5/16, 7/16, and 3/16 for 6, 7, 8, and 9.</p></div>
        <div><h2 className="font-display text-2xl font-medium">Why the steps are recorded</h2><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">The arithmetic is part of the method, not decoration. Every displayed left/right split conserves the working stalk count, and a browser-session record lets an interrupted reading resume at the next change. Six completed lines feed the same primary/changing/relating hexagram engine used by the coin method.</p><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">A physical practitioner's manner of splitting stalks can affect empirical randomness. This online tool therefore states its digital probability convention explicitly rather than claiming to reproduce every possible physical practice.</p></div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="font-display text-2xl font-medium">Reading the result</h2><p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">The final result is interpreted in the same structural order: primary hexagram first, changing lines second, relating hexagram when present. The free interpretation explains general hexagram themes without using your personal situation as an AI prompt.</p>
        <nav className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm" aria-label="Related yarrow guides"><Link href="/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">Changing lines</Link><Link href="/guides/primary-relating-hexagrams" className="font-semibold text-[var(--jade)] hover:underline">Primary & relating hexagrams</Link><Link href="/methods/three-coin" className="font-semibold text-[var(--jade)] hover:underline">Three-coin method</Link><Link href="/" className="font-semibold text-[var(--jade)] hover:underline">I Ching online home</Link></nav>
      </section>
    </article>
  );
}
