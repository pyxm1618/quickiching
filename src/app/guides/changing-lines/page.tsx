import type { Metadata } from "next";
import Link from "next/link";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import type { LineValue } from "@/domain/casting/types";

export const metadata: Metadata = {
  title: "I Ching Changing Lines — How Moving Lines Work",
  description: "Learn what changing lines mean in an I Ching reading, why 6 and 9 move, and how moving lines produce a relating hexagram.",
  alternates: { canonical: "/guides/changing-lines" },
  openGraph: { title: "I Ching Changing Lines — How Moving Lines Work", description: "Understand moving lines and the relating hexagram in an I Ching reading.", url: "/guides/changing-lines", type: "article" },
};

const WORKED_EXAMPLE_LINES = [7, 8, 9, 7, 6, 8] as const;
const WORKED_EXAMPLE = buildHexagramResult({ lineValuesBottomUp: WORKED_EXAMPLE_LINES, method: "three_coin" });
const WORKED_PRIMARY = hexagramByNumber(WORKED_EXAMPLE.primaryHexagramNumber);
if (WORKED_EXAMPLE.relatingHexagramNumber === null) throw new Error("GUIDE_WORKED_EXAMPLE_REQUIRES_RELATING_HEXAGRAM");
const WORKED_RELATING = hexagramByNumber(WORKED_EXAMPLE.relatingHexagramNumber);

function lineMeaning(value: LineValue): string {
  if (value === 6) return "Old yin";
  if (value === 7) return "Young yang";
  if (value === 8) return "Young yin";
  return "Old yang";
}

function lineChange(value: LineValue): string {
  if (value === 6) return "Changing → yang";
  if (value === 9) return "Changing → yin";
  return "Stable";
}

export default function ChangingLinesGuidePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">I Ching Guide</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">I Ching Changing Lines</h1>
      <p className="mt-5 text-lg leading-8 text-[var(--ink-2)]">Changing lines, also called moving lines, identify the positions where a cast changes polarity when the relating hexagram is calculated. The line values are always read from the bottom of the hexagram upward.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">The four line values</h2>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[32rem] border-collapse text-left text-sm"><thead><tr className="border-b border-[var(--line-strong)]"><th className="py-3 pr-4">Value</th><th className="py-3 pr-4">Line</th><th className="py-3">Changing?</th></tr></thead><tbody className="text-[var(--ink-2)]"><tr className="border-b border-[var(--line)]"><td className="py-3">6</td><td>Old yin</td><td>Yes → yang</td></tr><tr className="border-b border-[var(--line)]"><td className="py-3">7</td><td>Young yang</td><td>No</td></tr><tr className="border-b border-[var(--line)]"><td className="py-3">8</td><td>Young yin</td><td>No</td></tr><tr><td className="py-3">9</td><td>Old yang</td><td>Yes → yin</td></tr></tbody></table></div>

      <h2 className="mt-10 font-display text-2xl font-medium">From moving lines to a relating hexagram</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">First preserve the primary hexagram exactly as cast. Then reverse only the changing positions: 6 becomes yang and 9 becomes yin. The six resulting yin/yang positions map to the relating hexagram. Stable 7 and 8 lines keep their original polarity.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Worked example: 7 / 8 / 9 / 7 / 6 / 8</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">This sequence is shown in the same bottom-to-top order used by Quick I Ching’s casting domain. The example below is calculated by the project’s production hexagram function and King Wen mapping rather than by a separate guide-only lookup.</p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead><tr className="border-b border-[var(--line-strong)]"><th className="py-3 pr-4">Position</th><th className="py-3 pr-4">Value</th><th className="py-3 pr-4">Primary line</th><th className="py-3">What happens</th></tr></thead>
          <tbody className="text-[var(--ink-2)]">
            {WORKED_EXAMPLE.lineValuesBottomUp.map((value, index) => (
              <tr key={index} className="border-b border-[var(--line)] last:border-b-0">
                <td className="py-3 pr-4">Line {index + 1}</td>
                <td className="py-3 pr-4">{value}</td>
                <td className="py-3 pr-4">{lineMeaning(value)}</td>
                <td className="py-3">{lineChange(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 text-sm leading-7 text-[var(--ink-2)]">
        <p><strong className="text-[var(--ink)]">Primary:</strong> Hexagram {WORKED_PRIMARY.number} — {WORKED_PRIMARY.englishName}</p>
        <p className="mt-2"><strong className="text-[var(--ink)]">Changing positions:</strong> Lines {WORKED_EXAMPLE.movingLinePositions.join(" and ")}. Line 3 is old yang (9) and flips to yin; line 5 is old yin (6) and flips to yang.</p>
        <p className="mt-2"><strong className="text-[var(--ink)]">Relating:</strong> Hexagram {WORKED_RELATING.number} — {WORKED_RELATING.englishName}. Every other position remains exactly as it was in the primary hexagram.</p>
      </div>

      <h2 className="mt-10 font-display text-2xl font-medium">No, one, or multiple changing lines</h2>
      <div className="mt-5 space-y-4 text-sm leading-7 text-[var(--ink-2)]">
        <p><strong className="text-[var(--ink)]">No changing lines:</strong> a cast containing only 7 and 8 has no moving positions, so Quick I Ching does not generate a separate relating hexagram.</p>
        <p><strong className="text-[var(--ink)]">One changing line:</strong> only that one position reverses. The other five lines stay unchanged when the relating hexagram is formed.</p>
        <p><strong className="text-[var(--ink)]">Multiple changing lines:</strong> every actual 6 or 9 reverses at the same time. Together those changed positions form the relating hexagram; stable positions do not move.</p>
      </div>

      <h2 className="mt-10 font-display text-2xl font-medium">Reading order</h2>
      <ol className="mt-5 list-decimal space-y-3 pl-6 text-sm leading-7 text-[var(--ink-2)]">
        <li><strong>Primary Hexagram:</strong> understand the original six-line pattern first.</li>
        <li><strong>Changing Lines:</strong> identify the actual moving positions and what they emphasize.</li>
        <li><strong>Relating Hexagram:</strong> compare the structure produced by those specific flips.</li>
        <li><strong>Reflection:</strong> bring the layers together without treating the relating figure as a guaranteed future.</li>
      </ol>

      <h2 className="mt-10 font-display text-2xl font-medium">How to read change responsibly</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">I Ching changing lines show where the structure is not static. They can focus reflection on transition, tension, or a point that deserves attention. They do not prove that a specific event must occur, and a relating hexagram should not be treated as an unavoidable future state.</p>

      <nav className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-[var(--line)] pt-6 text-sm" aria-label="Related changing-line pages"><Link href="/guides/primary-relating-hexagrams" className="font-semibold text-[var(--jade)] hover:underline">Primary & relating hexagrams</Link><Link href="/methods/three-coin" className="font-semibold text-[var(--jade)] hover:underline">Three-coin method</Link><Link href="/methods/yarrow-stalks" className="font-semibold text-[var(--jade)] hover:underline">Yarrow stalk method</Link><Link href="/" className="font-semibold text-[var(--jade)] hover:underline">Start an I Ching reading</Link></nav>
    </article>
  );
}
