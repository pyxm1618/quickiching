import type { Metadata } from "next";
import Link from "next/link";
import { ThreeCoinTool } from "@/components/public-reading/three-coin-tool";
import { HOME_DESCRIPTION, HOME_H1, HOME_TITLE, SITE_ORIGIN } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
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
    <div>
      <section className="border-b border-[var(--line)]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--bronze)]">Quick I Ching · Book of Changes</p>
          <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.3rem,6vw,4.7rem)] font-medium leading-[1.05] tracking-[-0.025em]">{HOME_H1}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">Use the I Ching online without an account. The Three-Coin Method is ready below, with Yarrow Stalk and Mei Hua Yi Shu current-time casting available as complete alternatives. Every method ends with the hexagram structure and a free basic interpretation.</p>
        </div>
      </section>

      <section id="three-coin-reading" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12 sm:py-16">
        <ThreeCoinTool compactIntro />
      </section>

      <section id="other-casting-methods" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Other I Ching Casting Methods</p>
        <h2 className="mt-2 font-display text-3xl font-medium">Choose the ritual that fits your reading</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-6">
            <h3 className="font-display text-xl font-medium">Yarrow Stalk Method</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Work through the traditional 49-stalk structure as eighteen explicit digital changes, with browser-session resume and the standard yarrow line-value distribution.</p>
            <Link href="/methods/yarrow-stalks" className="mt-5 inline-flex min-h-11 items-center font-semibold text-[var(--jade)] hover:underline">Cast with yarrow stalks →</Link>
          </article>
          <article className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-6">
            <h3 className="font-display text-xl font-medium">Mei Hua Yi Shu</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Use Plum Blossom Divination with Quick I Ching's documented Gregorian current-time convention, including timezone, hour branch, and Zi-hour handling.</p>
            <Link href="/methods/mei-hua-yi-shu" className="mt-5 inline-flex min-h-11 items-center font-semibold text-[var(--jade)] hover:underline">Cast with the current time →</Link>
          </article>
        </div>
        <p className="mt-5 text-sm text-[var(--ink-3)]">Prefer the coin rules on their own page? <Link href="/methods/three-coin" className="font-semibold text-[var(--jade)] hover:underline">Open the Three-Coin Method guide and tool.</Link></p>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12">
        <h2 className="font-display text-3xl font-medium">How I Ching Online Readings Work</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <article className="rounded-xl border border-[var(--line)] p-6"><p className="font-mono text-xs text-[var(--bronze)]">01</p><h3 className="mt-3 font-display text-xl font-medium">Cast a six-line pattern</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Three coins and yarrow generate 6/7/8/9 line values from bottom to top. Mei Hua derives the trigrams and one changing line from the current time convention.</p></article>
          <article className="rounded-xl border border-[var(--line)] p-6"><p className="font-mono text-xs text-[var(--bronze)]">02</p><h3 className="mt-3 font-display text-xl font-medium">Identify the primary hexagram</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">The yin and yang structure maps to one of the 64 King Wen hexagrams. This is the primary hexagram—the reading's starting pattern.</p></article>
          <article className="rounded-xl border border-[var(--line)] p-6"><p className="font-mono text-xs text-[var(--bronze)]">03</p><h3 className="mt-3 font-display text-xl font-medium">Read change without certainty claims</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Values 6 and 9 are changing lines. Reversing them produces a relating hexagram, which offers another structure for reflection rather than a fixed prediction.</p></article>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="font-display text-3xl font-medium">Understanding Your Reading</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <article className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-6"><h3 className="font-display text-xl font-medium">Primary Hexagram</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">The six-line figure before any moving line changes. It is the main structural reference for the reading.</p><Link href="/hexagrams" className="mt-4 inline-block font-semibold text-[var(--jade)] hover:underline">Explore the 64 hexagrams</Link></article>
          <article className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-6"><h3 className="font-display text-xl font-medium">Changing Lines</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Old yin (6) and old yang (9) are the positions where the primary pattern changes.</p><Link href="/guides/changing-lines" className="mt-4 inline-block font-semibold text-[var(--jade)] hover:underline">Learn about changing lines</Link></article>
          <article className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-6"><h3 className="font-display text-xl font-medium">Relating Hexagram</h3><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">When changing lines exist, flipping their yin/yang state produces the relating hexagram.</p><Link href="/guides/primary-relating-hexagrams" className="mt-4 inline-block font-semibold text-[var(--jade)] hover:underline">Primary vs. relating hexagrams</Link></article>
        </div>
        <p className="mt-6 text-sm leading-7 text-[var(--ink-2)]">Before casting, you may also want to read <Link href="/guides/how-to-ask-the-i-ching" className="font-semibold text-[var(--jade)] hover:underline">how to ask the I Ching a useful reflective question</Link>.</p>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12 sm:py-16" aria-labelledby="faq-title">
        <h2 id="faq-title" className="font-display text-3xl font-medium">Common Questions About I Ching Online</h2>
        <div className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {FAQ.map(([question, answer]) => <details key={question} className="group py-4"><summary className="cursor-pointer list-none pr-6 font-semibold text-[var(--ink)] marker:content-none">{question}</summary><p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">{answer}</p></details>)}
        </div>
      </section>
    </div>
  );
}
