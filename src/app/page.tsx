import Link from "next/link";
import { PrelaunchCoinCast } from "@/components/prelaunch-coin-cast";

const STEPS = [
  {
    title: "Describe one situation",
    body: "A full release will ask for one clear scene, one interpretation goal, and only the context needed for reflection.",
  },
  {
    title: "Cast six irreversible lines",
    body: "Three coins form each line. Six lines create the primary pattern and identify any moving lines.",
  },
  {
    title: "Reflect without surrendering judgment",
    body: "Quick I Ching is designed to clarify conditions and change, not to replace medical, legal, financial, or safety advice.",
  },
] as const;

export default function HomePage() {
  return (
    <div>
      <section className="border-b border-[var(--line)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--bronze)]">Quick I Ching · Public preview</p>
          <h1 className="mt-5 max-w-4xl font-display text-[clamp(2.4rem,6vw,4.8rem)] font-medium leading-[1.05] tracking-[-0.025em]">
            Understand the pattern.<br />Keep the decision yours.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--ink-2)]">
            Quick I Ching is a structured reflection tool based on the traditional three-coin method. The free browser casting preview below is live. Accounts, saved readings, AI-generated interpretation, and payment checkout are not currently available.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a href="#coin-preview" className="rounded-md bg-[var(--cinnabar)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--cinnabar-deep)]">Try the free coin preview</a>
            <Link href="/pricing" className="rounded-md border border-[var(--line-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink-2)]">View planned pricing</Link>
          </div>
          <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 text-sm leading-7 text-[var(--ink-2)]">
            <strong className="text-[var(--ink)]">Service status:</strong> no payment can be made on this website at present. No Waffo, AI Gateway, Better Auth, database, or Workflow credential is required to load this page or use the browser-only preview.
          </div>
        </div>
      </section>

      <section id="coin-preview" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
        <PrelaunchCoinCast />
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-8 sm:py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">How the full product works</p>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <article key={step.title} className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-6">
              <p className="font-mono text-xs text-[var(--bronze)]">0{index + 1}</p>
              <h2 className="mt-3 font-display text-xl font-medium">{step.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-7 sm:flex sm:items-center sm:justify-between sm:gap-8">
          <div>
            <h2 className="font-display text-2xl font-medium">Transparent before payment</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--ink-2)]">Planned prices, legal terms, acceptable-use boundaries, and the monitored support address are public before checkout is enabled.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-4 sm:mt-0">
            <Link href="/pricing" className="font-semibold text-[var(--jade)] hover:underline">Pricing</Link>
            <Link href="/terms" className="font-semibold text-[var(--jade)] hover:underline">Terms</Link>
            <a href="mailto:support@quickiching.com" className="font-semibold text-[var(--jade)] hover:underline">Support</a>
          </div>
        </div>
      </section>
    </div>
  );
}
