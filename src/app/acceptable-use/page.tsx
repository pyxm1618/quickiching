import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceptable Use",
  description: "Boundaries for using Quick I Ching responsibly.",
  alternates: { canonical: "/acceptable-use" },
  robots: { index: false, follow: true },
};

export default function AcceptableUsePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Trust</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">Acceptable Use</h1>
      <p className="mt-5 text-lg leading-8 text-[var(--ink-2)]">Quick I Ching is built for reflection, not dependence or consequential certainty.</p>
      <ul className="mt-8 list-disc space-y-3 pl-6 text-sm leading-7 text-[var(--ink-2)]">
        <li>Do not treat readings as medical, legal, financial, investment, emergency, or safety directives.</li>
        <li>Do not present a reading as proof that a future event must occur or that another person has committed an act, has a hidden motive, or has a health condition.</li>
        <li>Do not use repeated casting to manufacture anxiety, dependency, or pressure to continue consulting the tool.</li>
        <li>Do not attempt to compromise, overload, scrape at abusive scale, or bypass technical or safety controls.</li>
        <li>Do not submit or expose another person's unnecessary private or confidential information.</li>
        <li>Do not use the service for harassment, coercion, fraud, discrimination, or other unlawful activity.</li>
      </ul>
      <p className="mt-8 text-sm leading-7 text-[var(--ink-2)]">If a real-world decision has serious consequences, use appropriate evidence and qualified professional support. An I Ching reading can remain a reflective framework without replacing those safeguards.</p>
    </article>
  );
}
