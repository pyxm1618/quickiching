import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import { ProductionMethodReleasePolicy } from "@/server/release/method-release";

/**
 * 首页（明室 · 编辑式，phototype/UI设计方案.md §6.1）：
 * 左文右卦双栏 Hero + 书页栏方法 + 三步承诺条。
 * 首屏只主推 Start Your Coin Reading（PRD §5.2）。
 */

// 地天泰（No.11）：自下而上 阳阳阳 阴阴阴
const TAI_LINES = [7, 7, 7, 8, 8, 8];

const METHODS = [
  {
    method: "three_coin" as const,
    idx: "01",
    name: "Three-Coin Method",
    zh: "三枚铜钱 · 入门正途",
    blurb: "Six rounds of three coins. The most direct and recognized way into the I Ching.",
    cast: "/cast/three_coin",
    guide: "/three-coin-method",
  },
  {
    method: "yarrow_stalk" as const,
    idx: "02",
    name: "Yarrow Stalk",
    zh: "蓍草 · 慢仪式",
    blurb: "An eighteen-step division of forty-nine stalks. Slower, deliberate, deeply traditional.",
    cast: "/cast/yarrow_stalk",
    guide: "/yarrow-stalk-method",
  },
  {
    method: "mei_hua_current_time" as const,
    idx: "03",
    name: "Mei Hua Yi Shu",
    zh: "梅花易数 · 时间起卦",
    blurb: "A hexagram formed from the current time in your confirmed timezone.",
    cast: "/cast/mei_hua_current_time",
    guide: "/mei-hua-yi-shu",
  },
] as const;

const STEPS = [
  { n: "I", title: "Ask with care", body: "Choose a scene, a goal, and describe your situation in your own words." },
  { n: "II", title: "Complete the ritual", body: "Each line is sealed the moment it is cast. No redo, no rewrite." },
  { n: "III", title: "Reveal & reflect", body: "Sign in to reveal the full pattern — free — then unlock a deep reading if you choose." },
] as const;

export default function HomePage() {
  const releasePolicy = new ProductionMethodReleasePolicy(process.env);

  return (
    <div>
      {/* Hero：左文右卦 */}
      <section className="relative overflow-hidden border-b border-[var(--line)]">
        <span
          aria-hidden
          className="font-cjk pointer-events-none absolute -top-20 left-[36%] select-none text-[300px] leading-none text-[var(--ink)]/[0.045]"
        >
          易
        </span>
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-[1.15fr,0.85fr] md:py-24">
          <div>
            <p className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-[var(--bronze)]">
              A quiet ritual for a changing moment
            </p>
            <h1 className="mt-5 font-display text-[clamp(2.2rem,3.6vw,3.4rem)] font-medium leading-[1.14] tracking-[-0.015em]">
              Understand where you are.
              <br />
              See <em className="italic text-[var(--cinnabar)]">how it may be changing.</em>
            </h1>
            <p className="mt-6 max-w-[480px] text-[16.5px] leading-relaxed text-[var(--ink-2)]">
              Cast a hexagram through a formal, irreversible ritual. Reveal the classic pattern for
              free — then unlock a deep reading written for your exact situation.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-6">
              <Link href="/cast/three_coin">
                <Button size="lg">Start Your Coin Reading</Button>
              </Link>
              <Link
                href="/casting-methods"
                className="text-[15px] font-semibold text-[var(--jade)] hover:underline"
              >
                Explore all methods →
              </Link>
            </div>
          </div>

          {/* 氛围展品：泰卦 */}
          <div className="relative flex flex-col items-center justify-center gap-4 rounded-lg border border-[var(--line)] bg-[var(--paper-raised)] p-8">
            <div className="flex items-baseline gap-3">
              <span className="font-cjk text-3xl font-semibold">泰</span>
              <span className="font-mono text-xs tracking-[0.1em] text-[var(--ink-3)]">
                NO. 11 · TAI · PEACE
              </span>
            </div>
            <HexagramLines lines={TAI_LINES} size="lg" className="w-40" />
            <p className="font-mono text-[11px] tracking-[0.08em] text-[var(--ink-3)]">
              ☷ OVER ☰ · EARTH ABOVE, HEAVEN BELOW
            </p>
          </div>
        </div>
      </section>

      {/* 方法书页栏 */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="grid divide-y divide-[var(--line)] border-b border-[var(--line)] md:grid-cols-3 md:divide-x md:divide-y-0">
          {METHODS.map((m) => {
            const released = releasePolicy.isReleased(m.method);
            return (
              <div key={m.idx} className="group px-2 py-10 md:px-8">
                <p className="font-mono text-xs tracking-[0.1em] text-[var(--bronze)]">{m.idx}</p>
                <h3 className="mt-3 font-display text-[22px] font-medium tracking-[-0.01em]">
                  {m.name}
                </h3>
                <p className="font-cjk mt-1 text-sm text-[var(--ink-3)]">{m.zh}</p>
                <p className="mt-3 min-h-[3.5rem] text-sm leading-relaxed text-[var(--ink-2)]">
                  {m.blurb}
                </p>
                <div className="mt-5 flex items-center gap-5">
                  {released ? (
                    <Link href={m.cast} className="text-[13.5px] font-semibold text-[var(--jade)] hover:underline">
                      Begin the ritual →
                    </Link>
                  ) : (
                    <span className="text-[13.5px] font-semibold text-[var(--ink-3)]">
                      Pending domain approval
                    </span>
                  )}
                  <Link
                    href={m.guide}
                    className="text-[13.5px] text-[var(--ink-3)] transition-colors hover:text-[var(--ink)]"
                  >
                    How it works
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 三步承诺条 */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid overflow-hidden rounded-lg border border-[var(--line)] sm:grid-cols-3 sm:divide-x sm:divide-[var(--line)]">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-[var(--paper-raised)] px-7 py-7">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">
                Step {s.n}
              </p>
              <h4 className="mt-2 font-display text-[16.5px] font-medium">{s.title}</h4>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-3)]">{s.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
          Casting is free · Reveal and save after the ritual · No countdown, no false urgency
        </p>
      </section>
    </div>
  );
}
