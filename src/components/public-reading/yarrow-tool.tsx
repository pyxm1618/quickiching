"use client";

import { useEffect, useMemo, useState } from "react";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import { ReadingResult } from "@/components/public-reading/reading-result";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { generateYarrowChange, type YarrowChange } from "@/domain/casting/yarrow/algorithm";
import type { LineValue } from "@/domain/casting/types";
import { browserRandomInt } from "@/lib/browser-random";

const STORAGE_KEY = "quickiching:public-v1:yarrow-v2";

function isStoredChange(value: unknown): value is YarrowChange {
  if (!value || typeof value !== "object") return false;
  const change = value as Partial<YarrowChange>;
  return Number.isInteger(change.lineIndex) && Number.isInteger(change.changeIndex) && Number.isInteger(change.startingStalks) && Number.isInteger(change.endingStalks);
}

function readStoredChanges(): YarrowChange[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length > 18 || !parsed.every(isStoredChange)) return [];
    for (let index = 0; index < parsed.length; index += 1) {
      if (parsed[index].lineIndex !== Math.floor(index / 3) || parsed[index].changeIndex !== index % 3) return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

function completedLineValues(changes: YarrowChange[]): LineValue[] {
  const values: LineValue[] = [];
  for (let index = 2; index < changes.length; index += 3) {
    const value = changes[index].endingStalks / 4;
    if (![6, 7, 8, 9].includes(value)) throw new Error("YARROW_INVALID_STORED_LINE");
    values.push(value as LineValue);
  }
  return values;
}

export function YarrowTool() {
  const [changes, setChanges] = useState<YarrowChange[]>([]);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    setChanges(readStoredChanges());
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    if (changes.length === 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(changes));
  }, [changes, restored]);

  const lines = useMemo(() => completedLineValues(changes), [changes]);
  const complete = changes.length === 18;
  const result = complete ? buildHexagramResult({ lineValuesBottomUp: lines, method: "yarrow_stalk" }) : null;
  const latest = changes.at(-1);
  const currentLine = complete ? 6 : Math.floor(changes.length / 3) + 1;
  const currentChange = complete ? 3 : (changes.length % 3) + 1;

  function performChange() {
    if (complete) return;
    const lineIndex = Math.floor(changes.length / 3) as 0 | 1 | 2 | 3 | 4 | 5;
    const changeIndex = (changes.length % 3) as 0 | 1 | 2;
    const startingStalks = changeIndex === 0 ? 49 : changes[changes.length - 1].endingStalks;
    const next = generateYarrowChange(lineIndex, changeIndex, startingStalks, browserRandomInt);
    setChanges((current) => [...current, next]);
  }

  function reset() {
    setChanges([]);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  return (
    <section className="rounded-2xl border border-[var(--line-strong)] bg-[var(--paper-raised)] p-5 sm:p-8" aria-labelledby="yarrow-tool-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Yarrow Stalk Method</p>
          <h2 id="yarrow-tool-title" className="mt-2 font-display text-2xl font-medium">Complete 18 yarrow changes</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--ink-2)]">Three changes form one line; six lines form the hexagram. Each completed change is saved in this browser session so a refresh can resume the ritual.</p>
        </div>
        <span className="rounded-full border border-[var(--line)] px-3 py-1 font-mono text-xs text-[var(--ink-3)]">{changes.length} / 18 changes</span>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr),minmax(15rem,0.9fr)] md:items-center">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <HexagramLines lines={lines} sealedCount={lines.length} animateLast size="lg" showLabels />
        </div>
        <div className="text-sm leading-7 text-[var(--ink-2)]">
          <p><strong className="text-[var(--ink)]">Current position:</strong> line {currentLine}, change {currentChange}</p>
          {latest ? (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-[var(--line)] p-4">
              <dt>Started</dt><dd className="text-right font-mono">{latest.startingStalks}</dd>
              <dt>Left / right</dt><dd className="text-right font-mono">{latest.leftGroup} / {latest.rightGroup}</dd>
              <dt>Remainders</dt><dd className="text-right font-mono">{latest.leftRemainder} / {latest.rightRemainder}</dd>
              <dt>Remaining</dt><dd className="text-right font-mono">{latest.endingStalks}</dd>
            </dl>
          ) : (
            <p className="mt-4">Begin with 49 working stalks. The digital convention records a valid split and remainder calculation for every change.</p>
          )}
          <p className="mt-4 text-xs leading-6 text-[var(--ink-3)]">Quick I Ching uses an explicit Zhu Xi-style digital probability convention: the first change removes 5 or 9; later changes remove 4 or 8. This preserves the standard 6/7/8/9 line distribution while keeping every stalk calculation auditable.</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={performChange} disabled={complete} className="min-h-11 rounded-md bg-[var(--cinnabar)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--cinnabar-deep)] disabled:cursor-not-allowed disabled:opacity-50">
          {complete ? "Reading complete" : `Perform change ${changes.length + 1}`}
        </button>
        <button type="button" onClick={reset} disabled={changes.length === 0} className="min-h-11 rounded-md border border-[var(--line-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink-2)] disabled:cursor-not-allowed disabled:opacity-50">New reading</button>
      </div>

      {result ? <ReadingResult result={result} /> : null}
    </section>
  );
}
