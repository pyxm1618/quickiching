import type { Metadata } from "next";
import Link from "next/link";
import { QuestionFirst } from "@/components/public-reading/question-first";
import { MeiHuaTool } from "@/components/public-reading/mei-hua-tool";

export const metadata: Metadata = {
  title: "Mei Hua Yi Shu — Free Plum Blossom Current-Time Casting",
  description: "Use Mei Hua Yi Shu online with Quick I Ching's documented current-time convention. See the trigrams, changing line, hexagrams, and a free basic interpretation.",
  alternates: { canonical: "/methods/mei-hua-yi-shu" },
  openGraph: { title: "Mei Hua Yi Shu — Free Plum Blossom Current-Time Casting", description: "Cast a Plum Blossom I Ching hexagram from the current time using a documented convention.", url: "/methods/mei-hua-yi-shu", type: "website" },
};

export default function MeiHuaPage() {
  return (
    <article>
      <header className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Plum Blossom Divination · Current Time</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">Mei Hua Yi Shu — Current-Time Casting</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">Mei Hua Yi Shu includes multiple ways to form a hexagram from observed numbers and circumstances. Quick I Ching implements one current-time convention and states its calendar choices explicitly rather than presenting them as the only traditional rule.</p>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-12"><QuestionFirst storageKey="quickiching:public-v1:mei-hua-v2" legacyStorageKeys={["quickiching:question:mei-hua-yi-shu"]}><MeiHuaTool /></QuestionFirst></section>

      <section className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-2">
        <div><h2 className="font-display text-2xl font-medium">Classical arithmetic behind the convention</h2><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">The current-time rule uses a 1–12 year number, month and day for the upper trigram; adding the 1–12 hour branch gives the lower trigram and moving line. Division remainders map to the eight trigrams and six line positions.</p><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Quick I Ching preserves that arithmetic while making a specific civil-calendar choice for an international web tool.</p></div>
        <div><h2 className="font-display text-2xl font-medium">Quick I Ching’s calendar choices</h2><ul className="mt-4 list-disc space-y-2 pl-6 text-sm leading-7 text-[var(--ink-2)]"><li><strong>Year:</strong> Gregorian year converted to its terrestrial-branch ordinal, with 2020 as Zi = 1.</li><li><strong>Month/day:</strong> Gregorian civil month and date, not lunar-calendar values.</li><li><strong>Hour:</strong> the 12 earthly branches; Zi is 23:00–00:59.</li><li><strong>Zi rollover:</strong> 23:00 uses the next Gregorian formula date.</li><li><strong>Timezone:</strong> the user-confirmed IANA zone determines local civil time and DST.</li><li><strong>Leap month:</strong> not applicable because this convention does not use lunar months; Gregorian leap day is handled normally.</li></ul></div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="font-display text-2xl font-medium">How to interpret the result</h2><p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">Current-time casting creates one moving line. Read the primary hexagram as the starting pattern, then note the single changing position and the relating hexagram created by reversing that line. The free text remains a general reflection framework, not a claim that the timestamp determines a fixed future.</p>
        <nav className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm" aria-label="Related Mei Hua guides"><Link href="/hexagrams" className="font-semibold text-[var(--jade)] hover:underline">64 Hexagrams hub</Link><Link href="/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">Changing lines</Link><Link href="/" className="font-semibold text-[var(--jade)] hover:underline">I Ching online home</Link></nav>
      </section>
    </article>
  );
}
