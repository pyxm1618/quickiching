import type { Metadata } from "next";
import { HistoryClient } from "@/components/public-reading/history-client";

export const metadata: Metadata = {
  title: "Local Reading History — Quick I Ching",
  description: "View, rename, and delete readings saved only in this browser. Quick I Ching does not create public reading URLs or cloud history.",
  robots: { index: false, follow: true },
};

export default function HistoryPage() {
  return (
    <article>
      <header className="mx-auto max-w-4xl px-4 py-12 sm:py-16"><p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Private · browser-only</p><h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">Local Reading History</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">Return to a saved reading without creating an account or sending the question and line facts to a server.</p></header>
      <section className="mx-auto max-w-6xl px-4 pb-16"><HistoryClient /></section>
    </article>
  );
}
