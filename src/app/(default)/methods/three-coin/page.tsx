import type { Metadata } from "next";
import Link from "next/link";
import { QuestionFirst } from "@/components/public-reading/question-first";
import { ThreeCoinTool } from "@/components/public-reading/three-coin-tool";

export const metadata: Metadata = {
  title: "I Ching Three-Coin Method — Free Coin Toss Reading",
  description: "Use the I Ching three-coin method online. Toss six lines from bottom to top, identify changing lines, and read the primary and relating hexagrams for free.",
  alternates: { canonical: "/methods/three-coin" },
  openGraph: { title: "I Ching Three-Coin Method — Free Coin Toss Reading", description: "Cast a complete free three-coin I Ching reading online.", url: "/methods/three-coin", type: "website" },
};

export default function ThreeCoinMethodPage() {
  return (
    <article>
      <header className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">I Ching Coin · Three Coin Method</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">I Ching Three-Coin Method</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">The three-coin I Ching method turns six coin tosses into a hexagram. Each completed toss is one line, built from the bottom upward; values 6 and 9 are changing lines.</p>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-12"><QuestionFirst storageKey="quickiching:public-v1:three-coin" legacyStorageKeys={["quickiching:question:home-three-coin", "quickiching:question:three-coin"]}><ThreeCoinTool /></QuestionFirst></section>

      <section className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-2">
        <div><h2 className="font-display text-2xl font-medium">How the coin method works</h2><ol className="mt-4 list-decimal space-y-3 pl-6 text-sm leading-7 text-[var(--ink-2)]"><li>Three independent coin faces are generated with browser Web Crypto.</li><li>Yang/head contributes 3 and yin/tail contributes 2.</li><li>The total becomes 6, 7, 8, or 9.</li><li>Repeat six times, with the first result as the bottom line.</li><li>6 and 9 move; reversing those lines derives the relating hexagram.</li></ol></div>
        <div><h2 className="font-display text-2xl font-medium">What you get</h2><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">The free result includes the full six-line figure, primary hexagram number and name, changing-line positions, a relating hexagram when one exists, and an original basic interpretation of the hexagram themes. It does not require sign-in, payment, or AI.</p><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">A generated line cannot be edited. Use <strong>New reading</strong> only when you intentionally want to discard the entire browser-session reading and start again.</p></div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="font-display text-2xl font-medium">Understanding a three-coin reading</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">Start with the primary hexagram as the main pattern. If moving lines appear, note where change occurs before looking at the relating hexagram. The relating figure is a second structural reference, not a guaranteed outcome.</p>
        <nav className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm" aria-label="Related three-coin guides"><Link href="/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">Changing lines</Link><Link href="/guides/primary-relating-hexagrams" className="font-semibold text-[var(--jade)] hover:underline">Primary & relating hexagrams</Link><Link href="/guides/how-to-ask-the-i-ching" className="font-semibold text-[var(--jade)] hover:underline">How to ask the I Ching</Link><Link href="/methods/yarrow-stalks" className="font-semibold text-[var(--jade)] hover:underline">Compare the yarrow method</Link></nav>
      </section>
    </article>
  );
}
