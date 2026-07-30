import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Primary & Relating Hexagrams",
  description: "How the I Ching builds a hexagram from six lines, and what the primary and relating hexagrams represent.",
  alternates: { canonical: "/primary-and-relating-hexagrams" },
};

export default function PrimaryRelatingPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Primary &amp; Relating Hexagrams</h1>
      <p className="mt-4 text-[var(--muted)]">
        A hexagram is built from six lines, read from the bottom (first) to the top (sixth). The
        lower three lines form the lower trigram; the upper three form the upper trigram.
      </p>
      <h2 className="mt-8 text-xl font-semibold">Primary hexagram</h2>
      <p className="mt-3 text-[var(--muted)]">
        The primary hexagram describes the present situation — the overall environment and the
        forces currently at work.
      </p>
      <h2 className="mt-8 text-xl font-semibold">Relating hexagram</h2>
      <p className="mt-3 text-[var(--muted)]">
        If any line moves, the relating hexagram shows the structure that may emerge if the present
        trend continues. It is a possible direction, not a guaranteed outcome. With no moving lines,
        the relating hexagram is simply absent.
      </p>
    </article>
  );
}
