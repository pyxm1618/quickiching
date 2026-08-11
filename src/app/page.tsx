import type { Metadata } from "next";
import Link from "next/link";
import { ThreeCoinTool } from "@/components/public-reading/three-coin-tool";
import { HOME_DESCRIPTION, HOME_H1, HOME_TITLE, SITE_ORIGIN } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  alternates: { canonical: `${SITE_ORIGIN}/` },
  openGraph: { title: HOME_TITLE, description: HOME_DESCRIPTION, url: SITE_ORIGIN, type: "website" },
};

const FAQ = [
  ["What is an I Ching reading?", "An I Ching reading uses a six-line hexagram from the Book of Changes as a structured framework for reflection. The primary hexagram describes the main pattern; moving lines, when present, create a relating hexagram."],
  ["How does an online I Ching reading work?", "Quick I Ching performs the casting rules in your browser. Choose a method, complete its steps, then read the primary hexagram, changing lines, relating hexagram when present, and a free basic interpretation."],
  ["Is the I Ching reading free?", "Yes. The three launch methods provide a complete free basic reading without sign-in, payment, or a production AI service. Future personalized deep readings are a separate commercial feature and are not required here."],
  ["How does the three-coin method work?", "Each of three coins contributes 2 for yin or 3 for yang. The total is 6, 7, 8, or 9. Repeat six times from the bottom line upward; 6 and 9 are changing lines."],
  ["What are changing lines?", "Changing lines are line values 6 or 9. They mark positions that reverse from yin to yang or yang to yin when the relating hexagram is calculated."],
  ["What is a relating hexagram?", "When one or more lines change, those reversals form a second hexagram. It is useful for considering how the primary pattern is changing, not as a guaranteed future outcome."],
  ["What is the difference between three coins and yarrow stalks?", "Both produce the same 6/7/8/9 line values, but the rituals differ. Three coins use six quick tosses; the yarrow method uses three stalk-counting changes for each line, eighteen changes in all."],
  ["What is Mei Hua Yi Shu?", "Mei Hua Yi Shu, often called Plum Blossom Divination, includes methods that derive trigrams and a moving line from numbers or time. Quick I Ching launches with one clearly documented current-time convention."],
  ["Can I ask the I Ching the same question again?", "You can start a new browser reading, but repeated casting just to chase a preferred answer is not encouraged. Reflection is usually more useful when you first work with the result and new real-world information."],
  ["Does an I Ching reading predict the future?", "Quick I Ching does not present a reading as deterministic prediction. It is an interpretive framework for examining patterns and change, and it does not replace medical, legal, financial, or safety advice."],
] as const;

export default function HomePage() {
  return (
    <article className="home-oracle">
      <section className="relative overflow-hidden border-b border-white/[0.07]">
        <div className="mystic-shell grid min-h-[720px] items-center gap-10 py-16 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:py-20">
          <div className="relative z-10">
            <p className="mystic-kicker">Quick I Ching · Book of Changes</p>
            <h1 className="mt-5 max-w-4xl font-display text-[clamp(3.25rem,6vw,5.9rem)] font-normal leading-[.99] tracking-[-.055em] [text-shadow:0_0_70px_rgba(143,112,255,.12)]">{HOME_H1}</h1>
            <p className="mt-7 max-w-3xl text-[17px] leading-8 text-[var(--ink-2)] sm:text-lg">Use the I Ching online without an account. The Three-Coin Method is ready below, with Yarrow Stalk and Mei Hua Yi Shu current-time casting available as complete alternatives. Every method ends with the hexagram structure and a free basic interpretation.</p>
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
        <ThreeCoinTool compactIntro />
      </section>

      <section id="other-casting-methods" className="mystic-shell scroll-mt-24 py-16 sm:py-20">
        <div className="grid items-end gap-8 md:grid-cols-[.72fr_1.28fr] md:gap-14">
          <div>
            <p className="mystic-kicker">Other I Ching Casting Methods</p>
            <h2 className="mt-2 font-display text-4xl font-normal tracking-[-.04em] sm:text-5xl">Choose the ritual that fits your reading</h2>
          </div>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <article className="method-card-a">
            <div className="mb-8 font-display text-4xl text-[var(--gold)]" aria-hidden="true">◉ ◉ ◉</div>
            <h3>Three-Coin Method</h3>
            <p className="mt-4">Prefer the coin rules on their own page? <Link href="/methods/three-coin" className="font-semibold text-[var(--cyan)] hover:underline">Open the Three-Coin Method guide and tool.</Link></p>
          </article>
          <article className="method-card-a">
            <div className="mb-8 h-12 origin-left -rotate-6 font-display text-4xl tracking-[-.45em] text-[var(--gold)]" aria-hidden="true">||||||||||||</div>
            <h3>Yarrow Stalk Method</h3>
            <p className="mt-4">Work through the traditional 49-stalk structure as eighteen explicit digital changes, with browser-session resume and the standard yarrow line-value distribution.</p>
            <Link href="/methods/yarrow-stalks" className="mt-5 inline-flex min-h-11 items-center font-semibold text-[var(--cyan)] hover:underline">Cast with yarrow stalks →</Link>
          </article>
          <article className="method-card-a">
            <div className="mb-5 font-display text-6xl leading-none text-[var(--gold)]" aria-hidden="true">◷</div>
            <h3>Mei Hua Yi Shu</h3>
            <p className="mt-4">Use Plum Blossom Divination with Quick I Ching’s documented Gregorian current-time convention, including timezone, hour branch, and Zi-hour handling.</p>
            <Link href="/methods/mei-hua-yi-shu" className="mt-5 inline-flex min-h-11 items-center font-semibold text-[var(--cyan)] hover:underline">Cast with the current time →</Link>
          </article>
        </div>
      </section>

      <section id="how-it-works" className="mystic-shell scroll-mt-24 py-16 sm:py-20">
        <h2 className="font-display text-4xl font-normal tracking-[-.04em] sm:text-5xl">How I Ching Online Readings Work</h2>
        <div className="how-strip mt-9">
          <article><p className="font-display text-3xl text-[var(--gold)]">01</p><h3 className="mt-5 font-display text-xl font-normal">Cast a six-line pattern</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Three coins and yarrow generate 6/7/8/9 line values from bottom to top. Mei Hua derives the trigrams and one changing line from the current time convention.</p></article>
          <article><p className="font-display text-3xl text-[var(--gold)]">02</p><h3 className="mt-5 font-display text-xl font-normal">Identify the primary hexagram</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">The yin and yang structure maps to one of the 64 King Wen hexagrams. This is the primary hexagram—the reading’s starting pattern.</p></article>
          <article><p className="font-display text-3xl text-[var(--gold)]">03</p><h3 className="mt-5 font-display text-xl font-normal">Read change without certainty claims</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Values 6 and 9 are changing lines. Reversing them produces a relating hexagram, which offers another structure for reflection rather than a fixed prediction.</p></article>
        </div>
      </section>

      <section className="mystic-shell py-16 sm:py-20">
        <h2 className="font-display text-4xl font-normal tracking-[-.04em] sm:text-5xl">Understanding Your Reading</h2>
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          <article className="method-card-a"><h3>Primary Hexagram</h3><p className="mt-4">The six-line figure before any moving line changes. It is the main structural reference for the reading.</p><Link href="/hexagrams" className="mt-5 inline-block font-semibold text-[var(--cyan)] hover:underline">Explore the 64 hexagrams</Link></article>
          <article className="method-card-a"><h3>Changing Lines</h3><p className="mt-4">Old yin (6) and old yang (9) are the positions where the primary pattern changes.</p><Link href="/guides/changing-lines" className="mt-5 inline-block font-semibold text-[var(--cyan)] hover:underline">Learn about changing lines</Link></article>
          <article className="method-card-a"><h3>Relating Hexagram</h3><p className="mt-4">When changing lines exist, flipping their yin/yang state produces the relating hexagram.</p><Link href="/guides/primary-relating-hexagrams" className="mt-5 inline-block font-semibold text-[var(--cyan)] hover:underline">Primary vs. relating hexagrams</Link></article>
        </div>
        <p className="mt-7 text-sm leading-7 text-[var(--ink-2)]">Before casting, you may also want to read <Link href="/guides/how-to-ask-the-i-ching" className="font-semibold text-[var(--cyan)] hover:underline">how to ask the I Ching a useful reflective question</Link>.</p>
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
