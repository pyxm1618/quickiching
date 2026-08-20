import type { Metadata } from "next";
import Link from "next/link";
import { ManualCastTool } from "@/components/public-reading/manual-cast-tool";
import { QuestionFirst } from "@/components/public-reading/question-first";

export const metadata: Metadata = {
  title: "Manual I Ching Cast — Enter Lines or Moving Positions",
  description: "Build a deterministic I Ching reading by entering six line values or choosing a primary hexagram and moving lines. No randomness, no sign-in, and the same rich result as every other method.",
  alternates: { canonical: "/methods/manual-cast" },
  openGraph: { title: "Manual I Ching Cast — Enter Lines or Moving Positions", description: "Use Manual Cast to enter an I Ching structure directly and read the same primary, moving-line, and relating result.", url: "/methods/manual-cast", type: "website" },
};

export default function ManualCastPage() {
  return (
    <article>
      <header className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">I Ching · Manual Cast</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">Manual I Ching Cast</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">Enter a known six-line structure directly, or choose a primary hexagram and the lines that move. Manual Cast is useful for studying a paper cast, checking a transformation, or returning to a saved structure without introducing new randomness.</p>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-12"><QuestionFirst storageKey="quickiching:public-v1:manual-cast" legacyStorageKeys={["quickiching:question:manual-cast"]}><ManualCastTool /></QuestionFirst></section>

      <section className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-2">
        <div><h2 className="font-display text-2xl font-medium">Two equivalent input modes</h2><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Mode A accepts six explicit values—6, 7, 8, or 9—from line 1 at the bottom through line 6 at the top. Mode B accepts a primary hexagram plus zero to six moving positions, then maps stable yin/yang to 8/7 and moving yin/yang to 6/9.</p></div>
        <div><h2 className="font-display text-2xl font-medium">One shared result</h2><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Both modes use the same deterministic primary/changing/relating calculation and the same rich result. With no moving lines, no relating hexagram card is created. Nothing is sent to an AI service just to form the hexagram.</p><nav className="mt-5 flex flex-wrap gap-5 text-sm"><Link href="/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">Changing lines</Link><Link href="/hexagrams" className="font-semibold text-[var(--jade)] hover:underline">64 hexagrams</Link></nav></div>
      </section>
    </article>
  );
}
