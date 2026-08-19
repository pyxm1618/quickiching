import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changing Lines (Moving Lines)",
  description: "What 6, 7, 8, and 9 mean in the I Ching, and how moving lines create a relating hexagram.",
  alternates: { canonical: "/changing-lines" },
};

export default function ChangingLinesPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Changing Lines</h1>
      <p className="mt-4 text-[var(--muted)]">
        Each of the six lines is one of four values. The value determines whether the line is stable
        or moving, and whether it is yin or yang.
      </p>
      <div className="mt-6 overflow-hidden rounded-xl border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--card)] text-left">
            <tr>
              <th className="p-3">Value</th>
              <th className="p-3"> Nature</th>
              <th className="p-3">Moving?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            <tr><td className="p-3">6</td><td className="p-3">Old Yin</td><td className="p-3">Yes → becomes Yang</td></tr>
            <tr><td className="p-3">7</td><td className="p-3">Young Yang</td><td className="p-3">No</td></tr>
            <tr><td className="p-3">8</td><td className="p-3">Young Yin</td><td className="p-3">No</td></tr>
            <tr><td className="p-3">9</td><td className="p-3">Old Yang</td><td className="p-3">Yes → becomes Yin</td></tr>
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-[var(--muted)]">
        When one or more lines move, the changed lines form a second <em>relating hexagram</em>. The
        space between the primary and relating hexagrams is where a reading looks for what is
        shifting. If no line moves, there is no relating hexagram — the pattern is read as stable.
      </p>
    </article>
  );
}
