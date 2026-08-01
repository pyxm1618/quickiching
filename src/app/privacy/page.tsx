import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Quick I Ching handles your questions, readings, and account data.",
  alternates: { canonical: "/privacy" },
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Privacy</h1>
      <p className="mt-4 text-sm text-[var(--muted)]">Last updated: 2026-07-29 (draft for US launch review)</p>

      <h2 className="mt-8 text-xl font-semibold">What we collect</h2>
      <p className="mt-2 text-[var(--muted)]">
        Your question text, the hexagram it produces, any preview or reading, and your account email.
        Questions are treated as sensitive content and encrypted at rest.
      </p>

      <h2 className="mt-8 text-xl font-semibold">What we don’t do</h2>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-[var(--muted)]">
        <li>We don’t use your questions to train third-party models without explicit consent.</li>
        <li>We don’t show question text in analytics events.</li>
        <li>We don’t keep more than is needed for the service, support, and legal retention.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">Your rights</h2>
      <p className="mt-2 text-[var(--muted)]">
        You can delete any individual reading from your account, and you can request full account
        deletion. Deleted content is hidden immediately and purged after a 30-day recovery window.
        Financial and anti-fraud records are kept only as required and stripped of unnecessary text.
      </p>
    </article>
  );
}
