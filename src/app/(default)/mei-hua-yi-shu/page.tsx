import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Mei Hua Yi Shu — Current-Time Casting",
  description:
    "How Mei Hua Yi Shu forms a hexagram from the current time and your timezone, with the upper/lower trigram and moving line rules.",
  alternates: { canonical: "/mei-hua-yi-shu" },
};

export default function MeiHuaYiShuPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Mei Hua Yi Shu</h1>
      <p className="mt-4 text-[var(--muted)]">
        Mei Hua Yi Shu (Plum Blossom Numerology) can cast a hexagram from the current moment. In this
        product we use the current-time method only — you cannot backfill a historical time.
      </p>

      <h2 className="mt-8 text-xl font-semibold">The rule we use</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-[var(--muted)]">
        <li>The server records the UTC time; you confirm your IANA timezone before casting.</li>
        <li>The upper trigram comes from (year + month + day) mod 8.</li>
        <li>The lower trigram and the single moving line use the local hour branch as well.</li>
        <li>The timestamp is fixed at cast time, so the result is reproducible and auditable.</li>
      </ul>

      <p className="mt-6 text-sm text-[var(--muted)]">
        Note: full lunar-calendar, leap-month, and traditional midnight-roll handling require an
        approved calendar library before public launch. This build uses the standard Gregorian +
        12-branch rule.
      </p>

      <div className="mt-10">
        <Link href="/cast/mei_hua_current_time">
          <Button size="lg">Cast with the Current Time</Button>
        </Link>
      </div>
    </article>
  );
}
