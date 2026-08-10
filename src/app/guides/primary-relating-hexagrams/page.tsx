import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Primary and Relating Hexagrams — I Ching Reading Guide",
  description: "Understand the difference between a primary hexagram, changing lines, and a relating hexagram in an I Ching reading.",
  alternates: { canonical: "/guides/primary-relating-hexagrams" },
  openGraph: { title: "Primary and Relating Hexagrams — I Ching Reading Guide", description: "Learn how primary and relating hexagrams connect through changing lines.", url: "/guides/primary-relating-hexagrams", type: "article" },
};

export default function PrimaryRelatingGuidePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">I Ching Guide</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">Primary and Relating Hexagrams</h1>
      <p className="mt-5 text-lg leading-8 text-[var(--ink-2)]">A complete I Ching reading begins with the primary hexagram. A separate relating hexagram appears only when one or more lines are changing.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Primary hexagram</h2><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">The primary hexagram is the six-line yin/yang pattern exactly as it was cast. It is the first structure to interpret because it records the reading before any moving line is reversed.</p>
      <h2 className="mt-10 font-display text-2xl font-medium">Relating hexagram</h2><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">For each changing line, old yin becomes yang and old yang becomes yin. The resulting six-line pattern is the relating hexagram. It can be read as another perspective on the change implicit in the original cast, not as a certain prediction.</p>
      <h2 className="mt-10 font-display text-2xl font-medium">When there is no relating hexagram</h2><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">A cast made only of 7 and 8 contains no moving lines. In that case the primary pattern stands on its own; Quick I Ching does not invent a second hexagram just to fill the result page.</p>
      <h2 className="mt-10 font-display text-2xl font-medium">A practical reading order</h2><ol className="mt-4 list-decimal space-y-2 pl-6 text-sm leading-7 text-[var(--ink-2)]"><li>Observe the primary hexagram as a whole.</li><li>Locate the changing line positions and note what changes structurally.</li><li>If present, compare the relating hexagram with the primary pattern.</li><li>Use the contrast for reflection while keeping real-world evidence and your own judgment in charge.</li></ol>

      <nav className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-[var(--line)] pt-6 text-sm" aria-label="Related hexagram guides"><Link href="/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">Changing lines</Link><Link href="/hexagrams" className="font-semibold text-[var(--jade)] hover:underline">64 Hexagrams hub</Link><Link href="/" className="font-semibold text-[var(--jade)] hover:underline">Cast an I Ching reading</Link></nav>
    </article>
  );
}
