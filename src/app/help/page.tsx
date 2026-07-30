import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Help",
  description: "Common questions about casting, revealing, credits, and data.",
  alternates: { canonical: "/help" },
};

export default function HelpPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Help</h1>

      <h2 className="mt-8 text-xl font-semibold">Is casting free?</h2>
      <p className="mt-2 text-[var(--muted)]">
        Yes. The ritual and the full original hexagram result are free. Only the optional deep reading
        uses a reading credit.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Why do I sign in?</h2>
      <p className="mt-2 text-[var(--muted)]">
        You can complete the ritual anonymously. Signing in reveals and saves your result so you can
        return to it later.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Can I ask the same question again?</h2>
      <p className="mt-2 text-[var(--muted)]">
        The same question (ignoring case and punctuation) is locked to its first result for 72 hours
        across all methods, to discourage repeated casting.
      </p>

      <h2 className="mt-8 text-xl font-semibold">How do I delete my data?</h2>
      <p className="mt-2 text-[var(--muted)]">
        Delete individual readings from your <Link href="/account" className="text-[var(--accent)]">account</Link>,
        or request full account deletion from the privacy page. (Account deletion UI is pending in this
        build.)
      </p>
    </article>
  );
}
