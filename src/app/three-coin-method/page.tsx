import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Three-Coin Method — Rules & Practice",
  description:
    "How the three-coin I Ching method works: head = 3, tail = 2, six rounds, moving lines, and the relating hexagram.",
  alternates: { canonical: "/three-coin-method" },
};

export default function ThreeCoinMethodPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Three-Coin Method</h1>
      <p className="mt-4 text-[var(--muted)]">
        This page covers the rule and practice of casting with three coins. It is distinct from the
        main tool landing page, which focuses on starting a reading.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Step by step</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-6 text-[var(--muted)]">
        <li>Form a single, concrete question in your mind.</li>
        <li>Flip three coins. Count heads as 3 and tails as 2.</li>
        <li>The sum (6–9) gives the first line, drawn from the bottom up.</li>
        <li>Repeat five more times to complete all six lines.</li>
        <li>Lines of 6 or 9 are moving lines and produce a relating hexagram.</li>
      </ol>

      <h2 className="mt-8 text-xl font-semibold">Why it is reliable here</h2>
      <p className="mt-3 text-[var(--muted)]">
        Each line is generated and stored on the server before it is shown to you. The animation
        cannot influence the result, and a refresh or retry returns the exact same line — an
        irreversible, auditable cast.
      </p>

      <div className="mt-10">
        <Link href="/cast/three_coin">
          <Button size="lg">Cast with Three Coins</Button>
        </Link>
      </div>
    </article>
  );
}
