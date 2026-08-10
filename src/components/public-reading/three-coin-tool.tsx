"use client";

import { useEffect, useMemo, useState } from "react";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import { ReadingResult } from "@/components/public-reading/reading-result";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { generateThreeCoinLine, type ThreeCoinStep } from "@/domain/casting/three-coin/algorithm";
import { browserRandomBit } from "@/lib/browser-random";

const STORAGE_KEY = "quickiching:public-v1:three-coin";

function readStoredSteps(): ThreeCoinStep[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ThreeCoinStep[];
    if (!Array.isArray(parsed) || parsed.length > 6) return [];
    return parsed.every((step, index) => step.lineIndex === index && [6, 7, 8, 9].includes(step.lineValue)) ? parsed : [];
  } catch {
    return [];
  }
}

export function ThreeCoinTool({ compactIntro = false }: { compactIntro?: boolean }) {
  const [steps, setSteps] = useState<ThreeCoinStep[]>([]);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    setSteps(readStoredSteps());
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    if (steps.length === 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(steps));
  }, [steps, restored]);

  const lines = useMemo(() => steps.map((step) => step.lineValue), [steps]);
  const complete = lines.length === 6;
  const result = complete ? buildHexagramResult({ lineValuesBottomUp: lines, method: "three_coin" }) : null;

  function toss() {
    if (complete) return;
    const lineIndex = steps.length as 0 | 1 | 2 | 3 | 4 | 5;
    const next = generateThreeCoinLine(lineIndex, browserRandomBit);
    setSteps((current) => [...current, next]);
  }

  function reset() {
    setSteps([]);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  return (
    <section className="rounded-2xl border border-[var(--line-strong)] bg-[var(--paper-raised)] p-5 sm:p-8" aria-labelledby="three-coin-tool-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Three-Coin Method</p>
          <h2 id="three-coin-tool-title" className="mt-2 font-display text-2xl font-medium">Cast six lines, bottom to top</h2>
          {!compactIntro ? (
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--ink-2)]">Each toss uses three fair browser-crypto bits. Heads/yang count as 3, tails/yin as 2, producing 6, 7, 8, or 9. A completed line is sealed; only a full reset starts a new reading.</p>
          ) : null}
        </div>
        <span className="rounded-full border border-[var(--line)] px-3 py-1 font-mono text-xs text-[var(--ink-3)]">{steps.length} / 6 lines</span>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr),minmax(14rem,0.8fr)] md:items-center">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <HexagramLines lines={lines} sealedCount={steps.length} animateLast size="lg" showLabels />
        </div>
        <div>
          {steps.length === 0 ? (
            <p className="text-sm leading-7 text-[var(--ink-2)]">The first toss becomes line 1 at the bottom of the hexagram.</p>
          ) : (
            <ol className="space-y-2 text-sm text-[var(--ink-2)]" aria-label="Completed coin tosses">
              {steps.map((step) => (
                <li key={step.lineIndex} className="flex justify-between gap-4 border-b border-[var(--line)] pb-2">
                  <span>Line {step.lineIndex + 1}: {step.coinFaces.join(" · ")}</span>
                  <strong className="text-[var(--ink)]">{step.lineValue}</strong>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={toss} disabled={complete} className="min-h-11 rounded-md bg-[var(--cinnabar)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--cinnabar-deep)] disabled:cursor-not-allowed disabled:opacity-50">
          {complete ? "Reading complete" : "Toss three coins"}
        </button>
        <button type="button" onClick={reset} disabled={steps.length === 0} className="min-h-11 rounded-md border border-[var(--line-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink-2)] disabled:cursor-not-allowed disabled:opacity-50">
          New reading
        </button>
      </div>

      {result ? <ReadingResult result={result} /> : null}
    </section>
  );
}
