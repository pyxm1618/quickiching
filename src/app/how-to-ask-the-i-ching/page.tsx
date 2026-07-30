import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to Ask the I Ching",
  description: "A practical guide to framing a clear, single question for an I Ching reading.",
  alternates: { canonical: "/how-to-ask-the-i-ching" },
};

export default function HowToAskPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">How to Ask the I Ching</h1>
      <p className="mt-4 text-[var(--muted)]">
        A good reading starts with a clear, single question. This product asks for three things:
        a situation, an interpretation goal, and a short description of your specific circumstances.
      </p>
      <h2 className="mt-8 text-xl font-semibold">Tips</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-[var(--muted)]">
        <li>Describe the situation, not just a yes/no. “What should I pay attention to about my job change?” works better than “Will I get the job?”</li>
        <li>Keep it to one concern. The same question asked again within 72 hours is locked to its first result.</li>
        <li>Don’t include names, addresses, account numbers, or medical record numbers. Keep it reflective.</li>
      </ul>
      <h2 className="mt-8 text-xl font-semibold">What it is not</h2>
      <p className="mt-3 text-[var(--muted)]">
        This is a structured reflection tool, not a substitute for medical, legal, financial, or
        safety advice. If a question falls into those areas, the product will guide you to the
        appropriate boundary rather than a personalized reading.
      </p>
    </article>
  );
}
