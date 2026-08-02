"use client";

import { useState } from "react";

const LINE_LABELS: Record<number, string> = {
  6: "Old yin · moving",
  7: "Young yang",
  8: "Young yin",
  9: "Old yang · moving",
};

function castLine(): number {
  const values = new Uint32Array(3);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => (value % 2 === 0 ? 2 : 3)).reduce(
    (sum, value) => sum + value,
    0,
  );
}

function LineMark({ value }: { value: number }) {
  const isYang = value % 2 === 1;
  return (
    <div className="flex min-w-32 items-center justify-center gap-3" aria-hidden="true">
      {isYang ? (
        <span className="block h-2 w-28 rounded-full bg-[var(--ink)]" />
      ) : (
        <>
          <span className="block h-2 w-12 rounded-full bg-[var(--ink)]" />
          <span className="block h-2 w-12 rounded-full bg-[var(--ink)]" />
        </>
      )}
    </div>
  );
}

export function PrelaunchCoinCast() {
  const [lines, setLines] = useState<number[]>([]);
  const complete = lines.length === 6;

  function toss() {
    if (complete) return;
    setLines((current) => [...current, castLine()]);
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-6 sm:p-8" aria-labelledby="coin-preview-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Live browser preview</p>
          <h2 id="coin-preview-title" className="mt-2 font-display text-2xl font-medium">Cast six lines with three coins</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--ink-2)]">
            Each click creates one line locally in your browser. No account is created, and the result is not sent to a server or saved.
          </p>
        </div>
        <p className="rounded-full border border-[var(--line)] px-3 py-1 font-mono text-xs text-[var(--ink-3)]">{lines.length} / 6 lines</p>
      </div>

      <div className="mt-8 min-h-72 rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--paper)] p-5">
        {lines.length === 0 ? (
          <p className="pt-24 text-center text-sm text-[var(--ink-3)]">The first toss forms the bottom line.</p>
        ) : (
          <ol className="flex flex-col-reverse gap-4" aria-label="Cast lines, bottom to top">
            {lines.map((value, index) => (
              <li key={`${index}-${value}`} className="grid grid-cols-[2rem,1fr] items-center gap-4 sm:grid-cols-[2rem,9rem,1fr]">
                <span className="font-mono text-xs text-[var(--bronze)]">{index + 1}</span>
                <LineMark value={value} />
                <span className="text-sm text-[var(--ink-2)]">{value} · {LINE_LABELS[value]}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={toss}
          disabled={complete}
          className="rounded-md bg-[var(--cinnabar)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--cinnabar-deep)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {complete ? "Casting complete" : "Toss three coins"}
        </button>
        <button
          type="button"
          onClick={() => setLines([])}
          disabled={lines.length === 0}
          className="rounded-md border border-[var(--line-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink-2)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset
        </button>
      </div>

      {complete ? (
        <p className="mt-5 rounded-lg bg-[var(--jade-wash)] px-4 py-3 text-sm leading-relaxed text-[var(--jade)]">
          Your six-line pattern is complete. Automated interpretation, saved history, sign-in, and paid deep readings are intentionally disabled in this public preview.
        </p>
      ) : null}
    </section>
  );
}
