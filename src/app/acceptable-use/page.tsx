import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceptable Use",
  description: "Boundaries for using Quick I Ching responsibly.",
  alternates: { canonical: "/acceptable-use" },
  robots: { index: false, follow: true },
};

export default function AcceptableUsePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Acceptable Use</h1>
      <p className="mt-4 text-[var(--muted)]">
        We built this to support reflection, not dependence. Please use it within these boundaries.
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-6 text-[var(--muted)]">
        <li>Don’t treat readings as medical, legal, financial, or safety directives.</li>
        <li>Don’t use the product to manufacture anxiety, dependency, or repeated casting on the same question.</li>
        <li>Don’t attempt to abuse, automate at scale, or circumvent limits, payments, or safety checks.</li>
        <li>Don’t submit other people’s private information in your questions.</li>
      </ul>
    </article>
  );
}
