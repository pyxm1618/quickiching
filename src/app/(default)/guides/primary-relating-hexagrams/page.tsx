import type { Metadata } from "next";
import Link from "next/link";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";

export const metadata: Metadata = {
  title: "Primary and Relating Hexagrams — I Ching Reading Guide",
  description: "Understand the difference between a primary hexagram, changing lines, and a relating hexagram in an I Ching reading.",
  alternates: { canonical: "/guides/primary-relating-hexagrams" },
  openGraph: { title: "Primary and Relating Hexagrams — I Ching Reading Guide", description: "Learn how primary and relating hexagrams connect through changing lines.", url: "/guides/primary-relating-hexagrams", type: "article" },
};

const STRUCTURE_EXAMPLE = buildHexagramResult({
  lineValuesBottomUp: [7, 8, 9, 7, 6, 8],
  method: "three_coin",
});
const STRUCTURE_PRIMARY = hexagramByNumber(STRUCTURE_EXAMPLE.primaryHexagramNumber);
if (STRUCTURE_EXAMPLE.relatingHexagramNumber === null) throw new Error("GUIDE_STRUCTURE_EXAMPLE_REQUIRES_RELATING_HEXAGRAM");
const STRUCTURE_RELATING = hexagramByNumber(STRUCTURE_EXAMPLE.relatingHexagramNumber);

export default function PrimaryRelatingGuidePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">I Ching Guide</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">Primary and Relating Hexagrams</h1>
      <p className="mt-5 text-lg leading-8 text-[var(--ink-2)]">Primary and relating hexagrams are two structures connected by the changing lines in one cast. The primary hexagram is always present; a separate relating hexagram exists only when at least one line actually changes.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Primary hexagram: the original structure</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">The primary hexagram is the six-line yin/yang pattern exactly as it was cast, before any moving line is reversed. It is the reading’s starting structure and should be understood first rather than treated as a temporary result that is immediately replaced.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Changing lines: the connection between the two</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Changing lines identify the exact positions where the primary structure transforms. Old yin (6) changes to yang; old yang (9) changes to yin. Stable values 7 and 8 stay as they are. These actual moving positions—not a second random cast—are what connect the primary and relating hexagrams.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Relating hexagram: the structure after the actual flips</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">The relating hexagram is produced by reversing every changing position and preserving every stable position. It gives a second structural perspective on the movement contained in the original cast. Quick I Ching does not present an I Ching relating hexagram as a fixed or guaranteed future state.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Structure example</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Using the bottom-to-top line values <strong className="text-[var(--ink)]">7 / 8 / 9 / 7 / 6 / 8</strong>, the project’s production domain calculation produces this relationship:</p>
      <div className="mt-6 grid gap-4 text-sm leading-7">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-[var(--bronze)]">Primary</p>
          <p className="mt-2 text-lg font-semibold">Hexagram {STRUCTURE_PRIMARY.number} — {STRUCTURE_PRIMARY.englishName}</p>
          <p className="mt-2 text-[var(--ink-2)]">This is the original six-line pattern before any moving position is flipped.</p>
        </div>
        <p className="text-center font-mono text-lg text-[var(--bronze)]" aria-hidden="true">↓</p>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-[var(--bronze)]">Changing positions</p>
          <p className="mt-2 text-lg font-semibold">Lines {STRUCTURE_EXAMPLE.movingLinePositions.join(" and ")}</p>
          <p className="mt-2 text-[var(--ink-2)]">Only these actual moving lines reverse. The remaining four positions retain their primary polarity.</p>
        </div>
        <p className="text-center font-mono text-lg text-[var(--bronze)]" aria-hidden="true">↓</p>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-[var(--bronze)]">Relating</p>
          <p className="mt-2 text-lg font-semibold">Hexagram {STRUCTURE_RELATING.number} — {STRUCTURE_RELATING.englishName}</p>
          <p className="mt-2 text-[var(--ink-2)]">This second structure comes from those specific flips; it is not independently generated.</p>
        </div>
      </div>

      <h2 className="mt-10 font-display text-2xl font-medium">When there are no changing lines</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">A cast made only of 7 and 8 contains no moving lines. In that case the primary hexagram stands on its own. Quick I Ching does not invent a second hexagram just to make the result look more complete.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">A practical reading order</h2>
      <ol className="mt-4 list-decimal space-y-2 pl-6 text-sm leading-7 text-[var(--ink-2)]"><li><strong>Primary Hexagram:</strong> observe the original pattern as a whole.</li><li><strong>Changing Lines:</strong> locate the moving positions and consider what they emphasize.</li><li><strong>Relating Hexagram:</strong> if present, compare the structure created by those exact changes.</li><li><strong>Reflection:</strong> bring the layers together while keeping real-world evidence and your own judgment in charge.</li></ol>

      <nav className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-[var(--line)] pt-6 text-sm" aria-label="Related hexagram guides"><Link href="/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">Changing lines</Link><Link href="/hexagrams" className="font-semibold text-[var(--jade)] hover:underline">64 Hexagrams hub</Link><Link href="/methods/three-coin" className="font-semibold text-[var(--jade)] hover:underline">Three-coin method</Link><Link href="/" className="font-semibold text-[var(--jade)] hover:underline">Cast an I Ching reading</Link></nav>
    </article>
  );
}
