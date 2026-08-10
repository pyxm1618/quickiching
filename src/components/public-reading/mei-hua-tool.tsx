"use client";

import { useEffect, useMemo, useState } from "react";
import { ReadingResult } from "@/components/public-reading/reading-result";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { MEI_HUA_CONVENTION_ID, meiHuaFromUtc } from "@/domain/casting/mei-hua/algorithm";

const STORAGE_KEY = "quickiching:public-v1:mei-hua-v2";

type StoredCast = { utcMillis: number; ianaTimeZone: string };

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function detectedTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function readStoredCast(): StoredCast | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCast;
    if (!Number.isFinite(parsed.utcMillis) || !validTimeZone(parsed.ianaTimeZone)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function MeiHuaTool() {
  const [timeZone, setTimeZone] = useState("UTC");
  const [cast, setCast] = useState<StoredCast | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = readStoredCast();
    if (stored) {
      setCast(stored);
      setTimeZone(stored.ianaTimeZone);
    } else {
      setTimeZone(detectedTimeZone());
    }
  }, []);

  const meiHua = useMemo(() => {
    if (!cast) return null;
    return meiHuaFromUtc(cast.utcMillis, cast.ianaTimeZone);
  }, [cast]);

  const result = meiHua
    ? buildHexagramResult({
        lineValuesBottomUp: meiHua.lineValuesBottomUp,
        method: "mei_hua_current_time",
        algorithmVersion: meiHua.algorithmVersion,
      })
    : null;

  function castCurrentTime() {
    const zone = timeZone.trim();
    if (!validTimeZone(zone)) {
      setError("Enter a valid IANA timezone, such as Asia/Singapore or America/New_York.");
      return;
    }
    const next = { utcMillis: Date.now(), ianaTimeZone: zone };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setError("");
    setCast(next);
  }

  function reset() {
    sessionStorage.removeItem(STORAGE_KEY);
    setCast(null);
    setError("");
    setTimeZone(detectedTimeZone());
  }

  const calculation = meiHua?.methodCalculation;

  return (
    <section className="rounded-2xl border border-[var(--line-strong)] bg-[var(--paper-raised)] p-5 sm:p-8" aria-labelledby="mei-hua-tool-title">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Mei Hua Yi Shu · Current-Time Casting</p>
      <h2 id="mei-hua-tool-title" className="mt-2 font-display text-2xl font-medium">Cast from the current moment</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">Confirm the timezone that should define your local civil time. The instant is fixed when you cast and remains fixed for this browser session.</p>

      <div className="mt-6 max-w-xl">
        <label htmlFor="mei-hua-timezone" className="block text-sm font-semibold text-[var(--ink)]">IANA timezone</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input id="mei-hua-timezone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} disabled={Boolean(cast)} spellCheck={false} className="min-h-11 flex-1 rounded-md border border-[var(--line-strong)] bg-[var(--paper)] px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-[var(--jade)] disabled:opacity-70" aria-describedby="mei-hua-timezone-help mei-hua-error" />
          <button type="button" onClick={castCurrentTime} disabled={Boolean(cast)} className="min-h-11 rounded-md bg-[var(--cinnabar)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--cinnabar-deep)] disabled:cursor-not-allowed disabled:opacity-50">Cast current time</button>
        </div>
        <p id="mei-hua-timezone-help" className="mt-2 text-xs leading-6 text-[var(--ink-3)]">Timezone conversion uses the browser’s IANA timezone data, including daylight-saving transitions where applicable.</p>
        {error ? <p id="mei-hua-error" role="alert" className="mt-2 text-sm text-[var(--cinnabar)]">{error}</p> : null}
      </div>

      <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 text-sm leading-7 text-[var(--ink-2)]">
        <h3 className="font-display text-lg font-medium text-[var(--ink)]">Convention used in Public V1</h3>
        <p className="mt-2">Quick I Ching uses <code>{MEI_HUA_CONVENTION_ID}</code>: a Gregorian civil-date current-time convention. The Gregorian year is converted to its 1–12 terrestrial-branch number; Gregorian month and day are used directly; the local hour is converted to the 12 earthly branches. Zi hour is 23:00–00:59, with 23:00 using the next Gregorian formula date.</p>
        <p className="mt-2">This convention does <strong>not</strong> use a lunar calendar or lunar leap months, so it is not presented as the only traditional Mei Hua calendar convention. Gregorian leap days are handled normally, and the chosen IANA timezone determines the local date and DST offset.</p>
      </div>

      {calculation ? (
        <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg font-medium">Recorded calculation</h3>
            <button type="button" onClick={reset} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink-2)]">New reading</button>
          </div>
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm text-[var(--ink-2)] sm:grid-cols-2">
            <div className="flex justify-between gap-4"><dt>Timezone</dt><dd className="font-mono">{String(calculation.ianaTimeZone)}</dd></div>
            <div className="flex justify-between gap-4"><dt>Formula date</dt><dd className="font-mono">{String(calculation.year)}-{String(calculation.month).padStart(2, "0")}-{String(calculation.day).padStart(2, "0")}</dd></div>
            <div className="flex justify-between gap-4"><dt>Local hour</dt><dd className="font-mono">{String(calculation.hour).padStart(2, "0")}:xx</dd></div>
            <div className="flex justify-between gap-4"><dt>Year / hour branch</dt><dd className="font-mono">{String(calculation.yearBranchNumber)} / {String(calculation.hourBranch)}</dd></div>
            <div className="flex justify-between gap-4"><dt>Upper / lower trigram no.</dt><dd className="font-mono">{String(calculation.upperTrigramNumber)} / {String(calculation.lowerTrigramNumber)}</dd></div>
            <div className="flex justify-between gap-4"><dt>Changing line</dt><dd className="font-mono">{String(calculation.movingLinePosition)}</dd></div>
          </dl>
        </div>
      ) : null}

      {result ? <ReadingResult result={result} /> : null}
    </section>
  );
}
