import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to Ask the I Ching — Practical Question Guide",
  description: "Learn how to frame a clear I Ching question for reflection without forcing a yes/no prediction or handing over your decision-making.",
  alternates: { canonical: "/guides/how-to-ask-the-i-ching" },
  openGraph: { title: "How to Ask the I Ching — Practical Question Guide", description: "A practical guide to asking one clear, reflective I Ching question.", url: "/guides/how-to-ask-the-i-ching", type: "article" },
};

const QUESTION_EXAMPLES = [
  {
    situation: "Career",
    bad: "Will I definitely get this job?",
    better: "What should I understand about this job opportunity before deciding how to proceed?",
    why: "The better question keeps the job opportunity at the center, but shifts from demanding a guaranteed outcome to examining what matters before you act.",
  },
  {
    situation: "Relationship",
    bad: "Does this person truly love me, and will we stay together?",
    better: "What should I understand about the pattern in this relationship before deciding how to respond?",
    why: "This avoids asking the reading to prove another person’s private feelings or promise a future. It focuses instead on the relationship pattern you can observe and respond to.",
  },
  {
    situation: "Timing",
    bad: "Is next Friday definitely the right day to launch?",
    better: "What conditions should I pay attention to when choosing the timing for this launch?",
    why: "The timing question remains specific, but it opens space to notice readiness, constraints, and signals rather than treating one date as magically guaranteed.",
  },
  {
    situation: "Difficult decision",
    bad: "Should I quit my job, yes or no?",
    better: "What should I understand about leaving my current role before I decide whether to resign?",
    why: "The decision stays yours. The reading is used to surface tensions and considerations around leaving, which you can compare with practical facts such as finances, alternatives, and obligations.",
  },
  {
    situation: "Personal growth",
    bad: "Will I finally become successful?",
    better: "What pattern should I understand in the way I am approaching my long-term goals?",
    why: "A broad promise of success is hard to interpret usefully. Focusing on your current pattern creates a clearer subject for reflection and a more actionable follow-up.",
  },
] as const;

export default function HowToAskGuidePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">I Ching Guide</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">How to Ask the I Ching</h1>
      <p className="mt-5 text-lg leading-8 text-[var(--ink-2)]">Learning how to ask the I Ching is mostly a question-framing skill: give the reading one clear situation and one core concern, while leaving enough room to notice patterns you may not have considered.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Core principles for I Ching questions</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">When you are deciding how to phrase an I Ching question, these five principles keep the inquiry focused without turning the reading into a substitute decision-maker.</p>
      <ul className="mt-5 list-disc space-y-3 pl-6 text-sm leading-7 text-[var(--ink-2)]">
        <li><strong>One situation:</strong> choose the job change, relationship, timing issue, or other situation that needs attention first instead of combining unrelated problems.</li>
        <li><strong>One core concern:</strong> ask one main thing about that situation. A cast becomes harder to interpret when the question contains several separate decisions.</li>
        <li><strong>Reflective rather than deterministic:</strong> ask what to understand, notice, or consider instead of demanding certainty about an outcome.</li>
        <li><strong>Specific enough to focus:</strong> name the real opportunity, transition, conflict, or decision rather than asking a vague question about your whole life.</li>
        <li><strong>Open enough to interpret:</strong> do not narrow the answer so tightly that only “yes” or “no” can fit. Leave room for conditions, tensions, and change.</li>
      </ul>

      <h2 className="mt-10 font-display text-2xl font-medium">Bad → better questions to ask the I Ching</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">There is no single magic wording. The useful distinction is whether your I Ching questions create a focused subject for reflection or ask the hexagram to guarantee facts it cannot establish.</p>
      <div className="mt-6 space-y-5">
        {QUESTION_EXAMPLES.map((example) => (
          <section key={example.situation} className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 sm:p-6">
            <h3 className="font-display text-xl font-medium">{example.situation}</h3>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--ink)]">Bad:</strong> “{example.bad}”</p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--ink)]">Better:</strong> “{example.better}”</p>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--ink)]">Why it is better:</strong> {example.why}</p>
          </section>
        ))}
      </div>

      <h2 className="mt-10 font-display text-2xl font-medium">What about yes / no questions?</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">A yes/no question can compress a six-line I Ching reading into less information than the cast actually provides. The primary hexagram, changing lines, and relating hexagram can describe conditions and movement that do not fit cleanly into a binary answer.</p>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">That does not require claiming that tradition universally forbids yes/no questions. For a practical reflective reading, however, “What should I understand about…?” or “What should I pay attention to before…?” usually gives you more to work with than “Will this happen?”</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Repeating the same question</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Repeatedly asking the I Ching the same question until a preferred answer appears makes it easier to select the result you wanted in advance. That weakens the reading’s value as a disciplined reflection on the situation in front of you.</p>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">A new cast is more reasonable when the underlying facts have genuinely changed: you received a job offer, a deadline moved, a relationship conversation changed the situation, or you are now asking a materially different question. Otherwise, work with the first result and compare it with new real-world evidence before casting again.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Professional and safety boundaries</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Do not use a reading to replace medical treatment advice, legal counsel, financial advice, emergency guidance, or other safety-critical professional judgment. You can use the I Ching as a cultural and reflective framework for how you are approaching a situation, while the actual medical, legal, financial, or emergency decision remains grounded in qualified help and evidence.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">A simple question check before you cast</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Before asking the I Ching, read your question once and check: does it name one real situation, contain one core concern, and leave you responsible for the final decision? If yes, it is usually focused enough to cast and open enough to interpret.</p>

      <nav className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-[var(--line)] pt-6 text-sm" aria-label="Related guides"><Link href="/" className="font-semibold text-[var(--jade)] hover:underline">Start an I Ching online reading</Link><Link href="/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">Understanding changing lines</Link><Link href="/methods/three-coin" className="font-semibold text-[var(--jade)] hover:underline">Three-coin method</Link></nav>
    </article>
  );
}
