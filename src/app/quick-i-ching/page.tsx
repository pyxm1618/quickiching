import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Quick I Ching — Three-Coin Reading",
  description:
    "Cast the I Ching with three coins. Learn the rule (yang/head = 3, yin/tail = 2), complete six rounds, and reveal your hexagram.",
  alternates: { canonical: "/quick-i-ching" },
};

export default function QuickIChingPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Quick I Ching · Three-Coin Method</h1>
      <p className="mt-4 text-[var(--muted)]">
        The three-coin method is the most accessible way to cast a hexagram. You flip three coins six
        times, building the hexagram from the bottom line upward. In this tool, every coin result is
        generated and saved on the server the moment you cast — the animation only shows what has
        already been recorded, so a refresh or retry always returns the same line.
      </p>

      <h2 className="mt-10 text-xl font-semibold">The rule we use (and show you)</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-[var(--muted)]">
        <li>Head / yang counts as <strong>3</strong>; tail / yin counts as <strong>2</strong>.</li>
        <li>The three values sum to <strong>6, 7, 8, or 9</strong>.</li>
        <li>
          6 and 9 are <em>moving lines</em> (old yin / old yang) that generate a second, relating hexagram.
        </li>
        <li>7 and 8 are stable lines.</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold">How a reading works</h2>
      <p className="mt-3 text-[var(--muted)]">
        After the ritual, sign in to reveal your primary hexagram, any moving lines, the relating
        hexagram, and a short fixed preview. A deep reading is an optional, separate purchase.
      </p>

      <div className="mt-10">
        <Link href="/cast/three_coin">
          <Button size="lg">Start Your Coin Reading</Button>
        </Link>
      </div>
    </article>
  );
}
