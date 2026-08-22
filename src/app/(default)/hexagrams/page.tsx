import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getBasicInterpretation } from "@/domain/interpretation/basic";
import { CLASSICAL_HEXAGRAMS } from "@/domain/public-reading/classical";
import { hexagramSeoFor } from "@/content/hexagrams/seo";
import { alternateLanguages } from "@/i18n/helpers";

export const metadata: Metadata = {
  title: "64 I Ching Hexagrams — King Wen Sequence Guide",
  description: "Explore all 64 I Ching hexagrams in the King Wen sequence with concise original theme summaries and links to free online casting methods.",
  alternates: {
    canonical: "/hexagrams",
    languages: alternateLanguages("hexagrams-hub"),
  },
  openGraph: { title: "64 I Ching Hexagrams — King Wen Sequence Guide", description: "A concise hub for all 64 I Ching hexagrams in the King Wen sequence.", url: "/hexagrams", type: "website" },
};

export default function HexagramsHubPage() {
  return (
    <article className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Book of Changes</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">The 64 I Ching Hexagrams</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">This index lists the 64 hexagrams in the King Wen sequence. The short English theme summaries provide basic orientation, kept together so you can compare the sequence without treating each entry as a standalone prediction.</p>

      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CLASSICAL_HEXAGRAMS.map((hexagram) => {
          const interpretation = getBasicInterpretation(hexagram.number);
          const seo = hexagramSeoFor(hexagram.number, "en");
          return (
            <li key={hexagram.number} className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-5">
              <p className="font-mono text-xs text-[var(--bronze)]">Hexagram {hexagram.number}</p>
              <h2 className="mt-2 font-display text-lg font-medium"><Link href={`/hexagrams/${hexagram.slug}`} data-seo-inbound-anchor={seo.primaryKeyword} className="hover:text-[var(--jade)]">{seo.primaryKeyword}: {hexagram.englishName}</Link></h2>
              <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{interpretation.theme}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">{interpretation.summary}</p>
              <Link href={`/hexagrams/${hexagram.slug}`} className="mt-4 inline-flex text-sm font-semibold text-[var(--jade)] hover:underline">Open hexagram detail →</Link>
            </li>
          );
        })}
      </ol>

      <div className="mt-12 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-6">
        <h2 className="font-display text-2xl font-medium">Use the hexagrams in a reading</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">A hexagram is normally read in the context of a cast rather than selected as a standalone prediction. Start with the <Link href="/" data-seo-home-link="/" className="font-semibold text-[var(--jade)] hover:underline">I Ching online tool</Link>, or use the <Link href="/methods/yarrow-stalks" className="font-semibold text-[var(--jade)] hover:underline">yarrow stalk method</Link>, <Link href="/methods/mei-hua-yi-shu" className="font-semibold text-[var(--jade)] hover:underline">Mei Hua Yi Shu current-time method</Link>, or <Link href="/methods/manual-cast" className="font-semibold text-[var(--jade)] hover:underline">Manual Cast</Link>.</p>
      </div>
    </article>
  );
}
