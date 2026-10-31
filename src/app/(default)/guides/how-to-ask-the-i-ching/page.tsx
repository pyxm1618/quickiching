
import type { Metadata } from "next";
import { alternateLanguages } from "@/i18n/helpers";
import Link from "next/link";
import { InfoPageShell } from "@/components/info-pages/info-page-shell";
import styles from "@/components/info-pages/info-pages.module.css";

export const metadata: Metadata = {
  title: "How to Ask the I Ching — Practical Question Guide",
  description: "Learn how to frame a clear I Ching question for reflection without forcing a yes/no prediction or handing over your decision-making.",
  alternates: { canonical: "/guides/how-to-ask-the-i-ching", languages: alternateLanguages("guides-how-to-ask") },
  openGraph: { title: "How to Ask the I Ching — Practical Question Guide", description: "A practical guide to asking one clear, reflective I Ching question.", url: "/guides/how-to-ask-the-i-ching", type: "article" },
};

const QUESTION_EXAMPLES = [
  { situation: "Career", bad: "Will I definitely get this job?", better: "What should I understand about this job opportunity before deciding how to proceed?", why: "The better question keeps the job opportunity at the center, but shifts from demanding a guaranteed outcome to examining what matters before you act." },
  { situation: "Relationship", bad: "Does this person truly love me, and will we stay together?", better: "What should I understand about the pattern in this relationship before deciding how to respond?", why: "This avoids asking the reading to prove another person’s private feelings or promise a future. It focuses instead on the relationship pattern you can observe and respond to." },
  { situation: "Timing", bad: "Is next Friday definitely the right day to launch?", better: "What conditions should I pay attention to when choosing the timing for this launch?", why: "The timing question remains specific, but it opens space to notice readiness, constraints, and signals rather than treating one date as magically guaranteed." },
  { situation: "Difficult decision", bad: "Should I quit my job, yes or no?", better: "What should I understand about leaving my current role before I decide whether to resign?", why: "The decision stays yours. The reading is used to surface tensions and considerations around leaving, which you can compare with practical facts such as finances, alternatives, and obligations." },
  { situation: "Personal growth", bad: "Will I finally become successful?", better: "What pattern should I understand in the way I am approaching my long-term goals?", why: "A broad promise of success is hard to interpret usefully. Focusing on your current pattern creates a clearer subject for reflection and a more actionable follow-up." },
] as const;

export default function HowToAskGuidePage() {
  return (
    <InfoPageShell
      eyebrow="I Ching Guide"
      title="How to Ask the I Ching"
      lead="Learning how to ask the I Ching is mostly a question-framing skill: give the reading one clear situation and one core concern, while leaving enough room to notice patterns you may not have considered."
    >
      <section className={styles.guideMain}>
        <h2 className={styles.paperHeading}>Core principles for I Ching questions</h2>
        <p className={styles.paperText}>When you are deciding how to phrase an I Ching question, these five principles keep the inquiry focused without turning the reading into a substitute decision-maker.</p>
        <ul className={styles.principlesGrid}>
          <li><strong>One situation:</strong> choose the job change, relationship, timing issue, or other situation that needs attention first instead of combining unrelated problems.</li>
          <li><strong>One core concern:</strong> ask one main thing about that situation. A cast becomes harder to interpret when the question contains several separate decisions.</li>
          <li><strong>Reflective rather than deterministic:</strong> ask what to understand, notice, or consider instead of demanding certainty about an outcome.</li>
          <li><strong>Specific enough to focus:</strong> name the real opportunity, transition, conflict, or decision rather than asking a vague question about your whole life.</li>
          <li><strong>Open enough to interpret:</strong> do not narrow the answer so tightly that only “yes” or “no” can fit. Leave room for conditions, tensions, and change.</li>
        </ul>
      </section>

      <section className={styles.guideSecondary}>
        <h2 className={styles.paperHeading}>Bad → better questions to ask the I Ching</h2>
        <p className={styles.paperText}>There is no single magic wording. The useful distinction is whether your I Ching questions create a focused subject for reflection or ask the hexagram to guarantee facts it cannot establish.</p>
        <div className={styles.questionGrid}>
          {QUESTION_EXAMPLES.map((example) => (
            <section key={example.situation} className={styles.exampleCard}>
              <h3>{example.situation}</h3>
              <p><strong>Bad:</strong> “{example.bad}”</p>
              <p><strong>Better:</strong> “{example.better}”</p>
              <p><strong>Why it is better:</strong> {example.why}</p>
            </section>
          ))}
        </div>

        <section className={styles.sectionBreak}>
          <h2 className={styles.paperHeading}>What about yes / no questions?</h2>
          <p className={styles.paperText}>A yes/no question can compress a six-line I Ching reading into less information than the cast actually provides. The primary hexagram, changing lines, and relating hexagram can describe conditions and movement that do not fit cleanly into a binary answer.</p>
          <p className={styles.paperText}>That does not require claiming that tradition universally forbids yes/no questions. For a practical reflective reading, however, “What should I understand about…?” or “What should I pay attention to before…?” usually gives you more to work with than “Will this happen?”</p>
        </section>

        <section className={styles.sectionBreak}>
          <h2 className={styles.paperHeading}>Repeating the same question</h2>
          <p className={styles.paperText}>Repeatedly asking the I Ching the same question until a preferred answer appears makes it easier to select the result you wanted in advance. That weakens the reading’s value as a disciplined reflection on the situation in front of you.</p>
          <p className={styles.paperText}>A new cast is more reasonable when the underlying facts have genuinely changed: you received a job offer, a deadline moved, a relationship conversation changed the situation, or you are now asking a materially different question. Otherwise, work with the first result and compare it with new real-world evidence before casting again.</p>
        </section>

        <section className={styles.sectionBreak}>
          <h2 className={styles.paperHeading}>Professional and safety boundaries</h2>
          <p className={styles.paperText}>Do not use a reading to replace medical treatment advice, legal counsel, financial advice, emergency guidance, or other safety-critical professional judgment. You can use the I Ching as a cultural and reflective framework for how you are approaching a situation, while the actual medical, legal, financial, or emergency decision remains grounded in qualified help and evidence.</p>
        </section>

        <section className={styles.sectionBreak}>
          <h2 className={styles.paperHeading}>A simple question check before you cast</h2>
          <p className={styles.paperText}>Before asking the I Ching, read your question once and check: does it name one real situation, contain one core concern, and leave you responsible for the final decision? If yes, it is usually focused enough to cast and open enough to interpret.</p>
        </section>

        <nav className={styles.relatedNav} aria-label="Related guides">
          <Link href="/">Start an I Ching online reading</Link>
          <Link href="/guides/changing-lines">Understanding changing lines</Link>
          <Link href="/methods/three-coin">Three-coin method</Link>
        </nav>
      </section>
    </InfoPageShell>
  );
}
