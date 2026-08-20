import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Yarrow Stalk Method — Ritual & Steps",
  description:
    "The traditional 49-stalk Yarrow method: three changes per line, 18 steps total, and how it differs from the coin method.",
  alternates: { canonical: "/yarrow-stalk-method" },
};

export default function YarrowStalkMethodPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Yarrow Stalk Method</h1>
      <p className="mt-4 text-[var(--muted)]">
        The yarrow stalk method is the older, more contemplative ritual. It uses 49 stalks and forms
        each of the six lines through three successive changes — 18 steps in total.
      </p>

      <h2 className="mt-8 text-xl font-semibold">The structure</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-[var(--muted)]">
        <li>Begin with 49 stalks; set one aside as the observer.</li>
        <li>Split the remainder, take one from the right, and count both heaps by fours.</li>
        <li>Repeat the change three times to determine a single line.</li>
        <li>Each line resolves to 6, 7, 8, or 9; six lines complete the hexagram.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">In this product</h2>
      <p className="mt-3 text-[var(--muted)]">
        You confirm each change before continuing — there is no pre-recorded animation standing in
        for the ritual. The server records every step so a refresh restores your exact progress.
      </p>

      <div className="mt-10">
        <Link href="/cast/yarrow_stalk">
          <Button size="lg">Cast with Yarrow Stalks</Button>
        </Link>
      </div>
    </article>
  );
}
