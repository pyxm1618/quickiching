import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Casting Methods",
  description:
    "Compare the three I Ching casting methods: Three-Coin, Yarrow Stalk, and Mei Hua Yi Shu (current-time).",
  alternates: { canonical: "/casting-methods" },
};

const METHODS = [
  {
    idx: "01",
    name: "Three-Coin Method",
    zh: "三枚铜钱",
    href: "/three-coin-method",
    cast: "/cast/three_coin",
    blurb: "Six quick rounds of three coins. The default, fastest entry point.",
  },
  {
    idx: "02",
    name: "Yarrow Stalk Method",
    zh: "蓍草",
    href: "/yarrow-stalk-method",
    cast: "/cast/yarrow_stalk",
    blurb: "A slower 18-step ritual using 49 stalks, three changes per line.",
  },
  {
    idx: "03",
    name: "Mei Hua Yi Shu",
    zh: "梅花易数",
    href: "/mei-hua-yi-shu",
    cast: "/cast/mei_hua_current_time",
    blurb: "Form a hexagram from the current time and your confirmed timezone.",
  },
] as const;

export default function CastingMethodsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <p className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-[var(--bronze)]">
        Three rituals · one result
      </p>
      <h1 className="mt-4 font-display text-[clamp(1.9rem,3vw,2.6rem)] font-medium tracking-[-0.015em]">
        Casting Methods
      </h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-[var(--ink-2)]">
        All three methods produce the same unified hexagram result and share one entitlement system.
        The method shapes the ritual and how the hexagram is formed — it is never falsely tied to a
        particular kind of question.
      </p>

      <div className="mt-12 grid divide-y divide-[var(--line)] border-y border-[var(--line)] md:grid-cols-3 md:divide-x md:divide-y-0">
        {METHODS.map((m) => (
          <div key={m.idx} className="px-2 py-10 md:px-8">
            <p className="font-mono text-xs tracking-[0.1em] text-[var(--bronze)]">{m.idx}</p>
            <h2 className="mt-3 font-display text-[22px] font-medium tracking-[-0.01em]">{m.name}</h2>
            <p className="font-cjk mt-1 text-sm text-[var(--ink-3)]">{m.zh}</p>
            <p className="mt-3 min-h-[3.5rem] text-sm leading-relaxed text-[var(--ink-2)]">{m.blurb}</p>
            <div className="mt-5 flex items-center gap-5">
              <Link href={m.cast} className="text-[13.5px] font-semibold text-[var(--jade)] hover:underline">
                Begin the ritual →
              </Link>
              <Link
                href={m.href}
                className="text-[13.5px] text-[var(--ink-3)] transition-colors hover:text-[var(--ink)]"
              >
                How it works
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
