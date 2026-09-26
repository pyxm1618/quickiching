import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { QuestionFirst } from "@/components/public-reading/question-first";
import { ThreeCoinTool } from "@/components/public-reading/three-coin-tool";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { HOME_DESCRIPTION, HOME_H1, HOME_TITLE } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  alternates: { canonical: canonicalUrl("/"), languages: alternateLanguages("homepage") },
  openGraph: { title: HOME_TITLE, description: HOME_DESCRIPTION, url: canonicalUrl("/"), type: "website" },
};

const WEBSITE_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Quick I Ching",
  url: canonicalUrl("/"),
};

const FAQ = [
  ["What is an I Ching online reading?", "An I Ching online reading uses a six-line hexagram from the Book of Changes as a structured framework for reflection. The primary hexagram describes the main pattern; moving lines, when present, create a relating hexagram."],
  ["How does an I Ching online reading work?", "An I Ching online reading on Quick I Ching follows the casting rules for the method you choose. Complete its steps, then read the primary hexagram, changing lines, relating hexagram when present, and the free basic interpretation."],
  ["Is the I Ching online reading free?", "Yes. The full general cast interpretation is free across all four public casting methods, with no sign-in or payment required. Free readings never call AI or claim to interpret your specific situation."],
  ["How does the three-coin method work in I Ching online?", "For an I Ching online reading with three coins, each coin contributes 2 for yin or 3 for yang. The total is 6, 7, 8, or 9. Repeat six times from the bottom line upward; 6 and 9 are changing lines."],
  ["What are changing lines in an I Ching online reading?", "In an I Ching online reading, changing lines are values 6 or 9. They mark positions that reverse from yin to yang or yang to yin when the relating hexagram is calculated."],
  ["What is a relating hexagram in an I Ching online reading?", "When one or more lines change, those reversals form a second hexagram. It helps you consider how the primary pattern is changing, not a guaranteed future outcome."],
  ["Can I use coins or yarrow stalks for I Ching online?", "Yes. Both methods produce the same 6/7/8/9 line values, but the rituals differ. Three coins use six quick tosses; yarrow stalks use three counting changes for each line, eighteen changes in all."],
  ["Can I use Mei Hua Yi Shu for I Ching online?", "Yes. Quick I Ching includes a documented current-time Mei Hua Yi Shu method that derives trigrams and a moving line from the current civil time and timezone."],
  ["Can I ask the same question again with I Ching online?", "You can start a new browser reading, but repeated casting just to chase a preferred answer is not encouraged. Reflection is usually more useful after working with the first result and new real-world information."],
  ["Does an I Ching online reading predict the future?", "No. An I Ching online reading is presented as an interpretive framework for examining patterns and change, not deterministic prediction, and it does not replace medical, legal, financial, or safety advice."],
] as const;

export default function HomePage() {
  return (
    <article className="home-oracle">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_STRUCTURED_DATA) }}
      />

      <section className="relative overflow-hidden border-b border-white/[0.07]">
        <div className="mystic-shell grid min-h-[560px] items-center gap-10 py-16 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:py-20">
          <div className="relative z-10">
            <p className="mystic-kicker">Quick I Ching · Book of Changes</p>
            <h1 className="mt-5 max-w-4xl font-display text-[clamp(3.25rem,6vw,5.9rem)] font-normal leading-[.99] tracking-[-.055em] [text-shadow:0_0_70px_rgba(143,112,255,.12)]">{HOME_H1}</h1>
            <p className="mt-7 max-w-3xl text-[17px] leading-8 text-[var(--ink-2)] sm:text-lg">Use the I Ching online through one reflective loop: Ask → Cast → Understand → Reflect → Return. Choose Three-Coin, Yarrow Stalks, Mei Hua Yi Shu, or Manual Cast; every I Ching online reading keeps the six-line facts visible and ends with the same free, grounded result.</p>
          </div>

          <div className="oracle-stage" aria-hidden="true">
            <div className="oracle-aura" />
            <div className="oracle-orbit" />
            <div className="oracle-moon" />
            <div className="oracle-card left" />
            <div className="oracle-card right" />
            <div className="oracle-crystal" />
            <div className="absolute left-1/2 top-1/2 z-10 grid w-[118px] -translate-x-1/2 -translate-y-1/2 gap-2.5 opacity-80">
              <span className="h-2 rounded-full bg-[var(--gold-2)] shadow-[0_0_14px_rgba(232,198,122,.3)]" />
              <span className="flex gap-3"><i className="h-2 flex-1 rounded-full bg-[var(--gold-2)]" /><i className="h-2 flex-1 rounded-full bg-[var(--gold-2)]" /></span>
              <span className="h-2 rounded-full bg-[var(--cyan)] shadow-[0_0_16px_rgba(137,233,227,.3)]" />
              <span className="flex gap-3"><i className="h-2 flex-1 rounded-full bg-[var(--gold-2)]" /><i className="h-2 flex-1 rounded-full bg-[var(--gold-2)]" /></span>
              <span className="h-2 rounded-full bg-[var(--gold-2)]" />
              <span className="flex gap-3"><i className="h-2 flex-1 rounded-full bg-[var(--gold-2)]" /><i className="h-2 flex-1 rounded-full bg-[var(--gold-2)]" /></span>
            </div>
          </div>
        </div>
      </section>

      <section id="three-coin-reading" className="mystic-shell scroll-mt-24 py-16 sm:py-20">
        <QuestionFirst storageKey="quickiching:public-v1:three-coin" legacyStorageKeys={["quickiching:question:home-three-coin", "quickiching:question:three-coin"]}><ThreeCoinTool compactIntro /></QuestionFirst>
      </section>

      <section id="other-casting-methods" className="mystic-shell scroll-mt-24 py-16 sm:py-20">
        <div className="grid items-end gap-8 md:grid-cols-[.72fr_1.28fr] md:gap-14">
          <div>
            <p className="mystic-kicker">Other I Ching Casting Methods</p>
            <h2 className="mt-2 font-display text-4xl font-normal tracking-[-.04em] sm:text-5xl">Choose Your I Ching Online Casting Method</h2>
          </div>
            <p className="max-w-2xl text-sm leading-7 text-[var(--ink-2)]">An I Ching online reading can begin with coins, yarrow stalks, the documented Mei Hua current-time convention, or direct Manual Cast. Each method produces the same core hexagram structure while preserving its own facts and steps.</p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <article className="method-card-a">
            <div className="mb-8 font-display text-4xl text-[var(--gold)]" aria-hidden="true">◉ ◉ ◉</div>
            <h3>Three-Coin Method</h3>
            <p className="mt-4">Use the Three-Coin Method when you want an I Ching online cast with six familiar tosses and traditional 6/7/8/9 line values. <Link href="/methods/three-coin" className="font-semibold text-[var(--cyan)] hover:underline">Open the Three-Coin Method guide and tool.</Link></p>
          </article>
          <article className="method-card-a">
            <div className="mb-5 font-mono text-4xl text-[var(--gold)]" aria-hidden="true">6·7·8·9</div>
            <h3>Manual Cast</h3>
            <p className="mt-4">Manual Cast lets you use I Ching online with six line values from a physical cast, or choose a primary hexagram and moving lines directly. Both modes use the same deterministic transformation engine.</p>
            <Link href="/methods/manual-cast" className="mt-5 inline-flex min-h-11 items-center font-semibold text-[var(--cyan)] hover:underline">Open Manual Cast →</Link>
          </article>
          <article className="method-card-a">
            <div className="mb-8 h-12 origin-left -rotate-6 font-display text-4xl tracking-[-.45em] text-[var(--gold)]" aria-hidden="true">||||||||||||</div>
            <h3>Yarrow Stalk Method</h3>
            <p className="mt-4">For an I Ching online reading with yarrow stalks, work through the traditional 49-stalk structure as eighteen explicit digital changes, with browser-session resume and the standard yarrow line-value distribution.</p>
            <Link href="/methods/yarrow-stalks" className="mt-5 inline-flex min-h-11 items-center font-semibold text-[var(--cyan)] hover:underline">Cast with yarrow stalks →</Link>
          </article>
          <article className="method-card-a">
            <div className="mb-5 font-display text-6xl leading-none text-[var(--gold)]" aria-hidden="true">◷</div>
            <h3>Mei Hua Yi Shu</h3>
            <p className="mt-4">For an I Ching online reading with Mei Hua Yi Shu, use Quick I Ching’s documented Gregorian current-time convention, including timezone, hour branch, and Zi-hour handling.</p>
            <Link href="/methods/mei-hua-yi-shu" className="mt-5 inline-flex min-h-11 items-center font-semibold text-[var(--cyan)] hover:underline">Cast with the current time →</Link>
          </article>
        </div>
      </section>

      <section id="how-it-works" className="mystic-shell scroll-mt-24 py-16 sm:py-20">
        <h2 className="font-display text-4xl font-normal tracking-[-.04em] sm:text-5xl">How I Ching Online Readings Work</h2>
        <div className="how-strip mt-9">
          <article><p className="font-display text-3xl text-[var(--gold)]">01</p><h3 className="mt-5 font-display text-xl font-normal">Ask</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Start an I Ching online reading with one optional question. It never changes the casting facts and remains out of URLs, metadata, and analytics.</p></article>
          <article><p className="font-display text-3xl text-[var(--gold)]">02</p><h3 className="mt-5 font-display text-xl font-normal">Cast</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Cast the I Ching online by forming six lines from bottom to top with one of four documented methods, or enter a manual structure without randomness.</p></article>
          <article><p className="font-display text-3xl text-[var(--gold)]">03</p><h3 className="mt-5 font-display text-xl font-normal">Understand</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Read the primary hexagram, moving lines, and relating hexagram only when movement exists.</p></article>
          <article><p className="font-display text-3xl text-[var(--gold)]">04</p><h3 className="mt-5 font-display text-xl font-normal">Reflect → Return</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Save locally, return to the question, and compare the symbolic frame with real-world evidence over time.</p></article>
        </div>
      </section>

      <section className="mystic-shell py-16 sm:py-20">
        <h2 className="font-display text-4xl font-normal tracking-[-.04em] sm:text-5xl">Understanding Your I Ching Online Reading</h2>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">After you cast the I Ching online, read the result in layers: start with the primary hexagram, then consider any changing lines, and then compare the relating hexagram when change is present.</p>
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          <article className="method-card-a"><h3>Primary Hexagram</h3><p className="mt-4">In an I Ching online reading, the primary hexagram is the six-line figure before any moving line changes and the main structural reference for the result.</p><Link href="/hexagrams" data-seo-hub-link="/hexagrams" className="mt-5 inline-block font-semibold text-[var(--cyan)] hover:underline">Explore the 64 hexagrams</Link></article>
          <article className="method-card-a"><h3>Changing Lines</h3><p className="mt-4">In an I Ching online reading, old yin (6) and old yang (9) are the positions where the primary pattern changes.</p><Link href="/guides/changing-lines" className="mt-5 inline-block font-semibold text-[var(--cyan)] hover:underline">Learn about changing lines</Link></article>
          <article className="method-card-a"><h3>Relating Hexagram</h3><p className="mt-4">When changing lines exist, flipping their yin/yang state produces the relating hexagram.</p><Link href="/guides/primary-relating-hexagrams" className="mt-5 inline-block font-semibold text-[var(--cyan)] hover:underline">Primary vs. relating hexagrams</Link></article>
        </div>
        <p className="mt-7 text-sm leading-7 text-[var(--ink-2)]">Before casting, you may also want to read <Link href="/guides/how-to-ask-the-i-ching" className="font-semibold text-[var(--cyan)] hover:underline">how to ask the I Ching a useful reflective question</Link>.</p>
      </section>

      <section className="mystic-shell py-16 sm:py-20" aria-labelledby="online-reading-value-title">
        <p className="mystic-kicker">Free reading · visible method facts</p>
        <h2 id="online-reading-value-title" className="mt-2 font-display text-4xl font-normal tracking-[-.04em] sm:text-5xl">What You Get From an I Ching Online Reading</h2>
        <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <article className="method-card-a"><h3>Free basic result</h3><p className="mt-4">See the primary hexagram, changing lines when present, the relating hexagram, and a grounded basic interpretation without payment.</p></article>
          <article className="method-card-a"><h3>Visible casting facts</h3><p className="mt-4">The six line values stay visible so you can trace how the cast became the final hexagram structure.</p></article>
          <article className="method-card-a"><h3>Traditional line values</h3><p className="mt-4">Coin, yarrow, and manual methods preserve the familiar 6, 7, 8, and 9 values instead of hiding the transformation.</p></article>
          <article className="method-card-a"><h3>Private browser flow</h3><p className="mt-4">Your optional question stays in the browser flow and is kept out of URLs, metadata, and analytics.</p></article>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16 sm:px-7 sm:py-20" aria-labelledby="faq-title">
        <p className="mystic-kicker">Common questions</p>
        <h2 id="faq-title" className="mt-2 font-display text-4xl font-normal tracking-[-.04em] sm:text-5xl">Common Questions About I Ching Online</h2>
        <div className="faq-a mt-9">
          {FAQ.map(([question, answer]) => <details key={question}><summary>{question}</summary><p className="mt-3">{answer}</p></details>)}
        </div>
      </section>
    </article>
  );
}
