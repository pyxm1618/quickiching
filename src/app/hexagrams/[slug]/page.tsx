import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CLASSICAL_HEXAGRAMS } from "@/domain/public-reading/classical";
import { loadPublicHexagramKnowledge } from "@/domain/public-reading/knowledge";
import { absoluteUrl } from "@/lib/seo";

type PageProps = { params: Promise<{ slug: string }> };

function entryForSlug(slug: string) {
  return CLASSICAL_HEXAGRAMS.find((hexagram) => hexagram.slug === slug) ?? null;
}

export function generateStaticParams() {
  return CLASSICAL_HEXAGRAMS.map((hexagram) => ({ slug: hexagram.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = entryForSlug(slug);
  if (!entry) return {};
  const title = `Hexagram ${entry.number} ${entry.chineseName} · ${entry.englishName}`;
  const description = `${entry.judgment} ${entry.image} Explore the primary meaning, six changing-line anchors, and classical source metadata for Hexagram ${entry.number}.`;
  return {
    title,
    description,
    alternates: { canonical: `/hexagrams/${entry.slug}` },
    openGraph: { title, description, url: `/hexagrams/${entry.slug}`, type: "article" },
  };
}

export default async function HexagramDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const entry = entryForSlug(slug);
  if (!entry) notFound();
  const knowledge = await loadPublicHexagramKnowledge(entry.number);
  const sequenceIndex = CLASSICAL_HEXAGRAMS.findIndex((hexagram) => hexagram.number === knowledge.number);
  const previous = sequenceIndex > 0 ? CLASSICAL_HEXAGRAMS[sequenceIndex - 1] : null;
  const next = sequenceIndex >= 0 && sequenceIndex < CLASSICAL_HEXAGRAMS.length - 1 ? CLASSICAL_HEXAGRAMS[sequenceIndex + 1] : null;
  const canonicalUrl = absoluteUrl(`/hexagrams/${knowledge.slug}`);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        name: knowledge.seoTitle,
        description: knowledge.seoDescription,
        url: canonicalUrl,
        isPartOf: { "@type": "WebSite", name: "Quick I Ching", url: absoluteUrl("/") },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "64 Hexagrams", item: absoluteUrl("/hexagrams") },
          { "@type": "ListItem", position: 2, name: `Hexagram ${knowledge.number} ${knowledge.englishName}`, item: canonicalUrl },
        ],
      },
    ],
  };

  return (
    <article className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <nav className="text-sm text-[var(--ink-3)]" aria-label="Breadcrumb"><Link href="/hexagrams" className="hover:text-[var(--jade)]">64 Hexagrams</Link><span className="mx-2">/</span><span>Hexagram {knowledge.number}</span></nav>
      <header className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr),minmax(17rem,.65fr)] lg:items-end">
        <div><p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">King Wen {knowledge.number} · {knowledge.symbol}</p><h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-6xl">{knowledge.englishName} <span className="font-cjk text-[var(--gold-2)]">{knowledge.chineseName}</span></h1><p className="mt-3 font-mono text-sm text-[var(--ink-3)]">{knowledge.pinyin} · lower {knowledge.trigrams.lower} · upper {knowledge.trigrams.upper}</p><p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">{knowledge.interpretation.coreMeaning}</p></div>
        <div className="mystic-card-soft p-5"><p className="mystic-kicker">Classical text</p><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--gold-2)]">Judgment · </strong>{knowledge.judgment}</p><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--gold-2)]">Image · </strong>{knowledge.image}</p><p className="mt-4 border-t border-white/[0.08] pt-4 text-xs leading-6 text-[var(--ink-3)]">Source: <a href={knowledge.source.textSourceUrl} rel="noreferrer" className="text-[var(--cyan)] hover:underline">周易 · Wikisource</a>. {knowledge.source.textStatus} Record attribution: <a href={knowledge.source.recordSourceUrl} rel="noreferrer" className="text-[var(--cyan)] hover:underline">MIT data record</a>.</p></div>
      </header>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <section className="mystic-card p-6" aria-labelledby="hexagram-core-title"><p className="mystic-kicker">Core meaning · {knowledge.interpretation.coreTheme}</p><h2 id="hexagram-core-title" className="mt-2 font-display text-2xl font-normal">What this structure emphasizes</h2><dl className="mt-5 space-y-4 text-sm leading-7 text-[var(--ink-2)]"><div><dt className="font-semibold text-[var(--gold-2)]">Strength</dt><dd>{knowledge.interpretation.strength}</dd></div><div><dt className="font-semibold text-[var(--gold-2)]">Challenge</dt><dd>{knowledge.interpretation.challenge}</dd></div><div><dt className="font-semibold text-[var(--gold-2)]">Practical meaning</dt><dd>{knowledge.practicalMeaning}</dd></div><div><dt className="font-semibold text-[var(--gold-2)]">Structure</dt><dd>{knowledge.interpretation.structureInterpretation}</dd></div></dl><div className="mt-6 border-t border-white/[0.08] pt-5"><p className="mystic-kicker">Related concepts</p><ul className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ink-2)]">{knowledge.relatedConcepts.map((concept) => <li key={concept} className="rounded-full border border-white/[0.1] px-3 py-1">{concept}</li>)}</ul></div></section>
        <section className="mystic-card p-6" aria-labelledby="hexagram-reflection-title"><p className="mystic-kicker">Practical reflection</p><h2 id="hexagram-reflection-title" className="mt-2 font-display text-2xl font-normal">Questions to carry</h2><ul className="mt-5 space-y-4 text-sm leading-7 text-[var(--ink-2)]">{knowledge.interpretation.reflectionQuestions.map((question) => <li key={question} className="border-l border-[var(--gold)]/40 pl-4">{question}</li>)}</ul><div className="mt-6 border-t border-white/[0.08] pt-5"><p className="mystic-kicker">Watch for</p><ul className="mt-3 space-y-2 text-sm leading-7 text-[var(--ink-2)]">{knowledge.interpretation.watchFor.map((item) => <li key={item}>· {item}</li>)}</ul></div></section>
      </div>

      <section className="mt-10" aria-labelledby="hexagram-lines-title"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mystic-kicker">Six changing-line anchors</p><h2 id="hexagram-lines-title" className="mt-2 font-display text-3xl font-normal">Line-by-line interpretation</h2></div><p className="max-w-xl text-sm leading-7 text-[var(--ink-2)]">These six records are authored static content for this hexagram. Public reading links target these stable anchors; no 384 runtime pages are created.</p></div><nav className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm" aria-label="Reading structure guides"><Link href="/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">How changing lines work</Link><Link href="/guides/primary-relating-hexagrams" className="font-semibold text-[var(--jade)] hover:underline">Primary &amp; relating hexagrams</Link><Link href="/guides/how-to-ask-the-i-ching" className="font-semibold text-[var(--jade)] hover:underline">How to ask the I Ching</Link></nav><div className="mt-6 grid gap-4 lg:grid-cols-2">{knowledge.lines.map((line) => <article key={line.position} id={`line-${line.position}`} className="scroll-mt-28 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 sm:p-6"><div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="font-display text-xl font-medium">Line {line.position} · {line.theme}</h3><a href={`#line-${line.position}`} className="font-mono text-xs text-[var(--jade)] hover:underline">#line-{line.position}</a></div><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{line.meaning}</p><dl className="mt-5 grid gap-4 text-sm leading-7 text-[var(--ink-2)] sm:grid-cols-2"><div><dt className="font-semibold text-[var(--gold-2)]">Change dynamic</dt><dd>{line.changeDynamic}</dd></div><div><dt className="font-semibold text-[var(--gold-2)]">Caution</dt><dd>{line.caution}</dd></div><div><dt className="font-semibold text-[var(--gold-2)]">Reflection</dt><dd>{line.reflection}</dd></div><div><dt className="font-semibold text-[var(--gold-2)]">Synthesis</dt><dd>{line.synthesisPhrase}</dd></div></dl></article>)}</div></section>

      <section className="mystic-card-soft mt-10 p-6"><div className="grid gap-5 sm:grid-cols-2"><div><p className="mystic-kicker">Transition</p><p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">{knowledge.interpretation.transitionTheme}</p></div><div><p className="mystic-kicker">Stability</p><p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">{knowledge.interpretation.stabilityTheme}</p></div></div><nav className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/[0.08] pt-5 text-sm" aria-label="Hexagram detail navigation"><Link href="/hexagrams" className="font-semibold text-[var(--cyan)] hover:underline">Back to all 64 hexagrams</Link>{previous ? <Link href={`/hexagrams/${previous.slug}`} className="font-semibold text-[var(--cyan)] hover:underline">← {previous.number} · {previous.englishName}</Link> : null}{next ? <Link href={`/hexagrams/${next.slug}`} className="font-semibold text-[var(--cyan)] hover:underline">{next.number} · {next.englishName} →</Link> : null}<Link href="/methods/manual-cast" className="font-semibold text-[var(--cyan)] hover:underline">Try Manual Cast</Link><Link href="/" className="font-semibold text-[var(--cyan)] hover:underline">Start a reading</Link></nav></section>
    </article>
  );
}
