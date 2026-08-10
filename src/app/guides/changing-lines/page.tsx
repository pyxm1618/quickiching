import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "I Ching Changing Lines — How Moving Lines Work",
  description: "Learn what changing lines mean in an I Ching reading, why 6 and 9 move, and how moving lines produce a relating hexagram.",
  alternates: { canonical: "/guides/changing-lines" },
  openGraph: { title: "I Ching Changing Lines — How Moving Lines Work", description: "Understand moving lines and the relating hexagram in an I Ching reading.", url: "/guides/changing-lines", type: "article" },
};

export default function ChangingLinesGuidePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">I Ching Guide</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">I Ching Changing Lines</h1>
      <p className="mt-5 text-lg leading-8 text-[var(--ink-2)]">Changing lines, also called moving lines, identify the positions where a cast changes polarity when the relating hexagram is calculated.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">The four line values</h2>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[32rem] border-collapse text-left text-sm"><thead><tr className="border-b border-[var(--line-strong)]"><th className="py-3 pr-4">Value</th><th className="py-3 pr-4">Line</th><th className="py-3">Changing?</th></tr></thead><tbody className="text-[var(--ink-2)]"><tr className="border-b border-[var(--line)]"><td className="py-3">6</td><td>Old yin</td><td>Yes → yang</td></tr><tr className="border-b border-[var(--line)]"><td className="py-3">7</td><td>Young yang</td><td>No</td></tr><tr className="border-b border-[var(--line)]"><td className="py-3">8</td><td>Young yin</td><td>No</td></tr><tr><td className="py-3">9</td><td>Old yang</td><td>Yes → yin</td></tr></tbody></table></div>

      <h2 className="mt-10 font-display text-2xl font-medium">From moving lines to a relating hexagram</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">First preserve the primary hexagram exactly as cast. Then reverse only the changing positions: 6 becomes yang and 9 becomes yin. The six resulting yin/yang positions map to the relating hexagram. If there are no changing lines, there is no separate relating hexagram.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">How to read change responsibly</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Changing positions show where the structure is not static. They can focus reflection on transition, tension, or a point that deserves attention. They do not prove that a specific event must occur, and a relating hexagram should not be treated as an unavoidable future state.</p>

      <nav className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-[var(--line)] pt-6 text-sm" aria-label="Related changing-line pages"><Link href="/guides/primary-relating-hexagrams" className="font-semibold text-[var(--jade)] hover:underline">Primary & relating hexagrams</Link><Link href="/methods/three-coin" className="font-semibold text-[var(--jade)] hover:underline">Three-coin method</Link><Link href="/methods/yarrow-stalks" className="font-semibold text-[var(--jade)] hover:underline">Yarrow stalk method</Link></nav>
    </article>
  );
}
