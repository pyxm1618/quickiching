import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of use for I Ching Coin.",
  alternates: { canonical: "/terms" },
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Use</h1>
      <p className="mt-4 text-sm text-[var(--muted)]">Draft for US launch review (G-08 pending).</p>

      <h2 className="mt-8 text-xl font-semibold">The service</h2>
      <p className="mt-2 text-[var(--muted)]">
        I Ching Coin is a structured reflection tool based on the I Ching. It is not a prediction
        service and does not guarantee accuracy. It is not a substitute for medical, legal, financial,
        or safety advice.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Purchases &amp; refunds</h2>
      <p className="mt-2 text-[var(--muted)]">
        Reading credits are valid for 12 months from purchase. Refunds follow US consumer rules and
        our payment provider’s policy. Delivered reports are not altered or deleted on refund.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Acceptable use</h2>
      <p className="mt-2 text-[var(--muted)]">
        Don’t use the product to make decisions about medical treatment, legal action, or specific
        investments in place of professionals, and don’t attempt to abuse, automate, or circumvent
        the service.
      </p>
    </article>
  );
}
