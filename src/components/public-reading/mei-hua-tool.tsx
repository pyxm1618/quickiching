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
    <section className="mystic-card overflow-hidden p-5 sm:p-8" aria-labelledby="mei-hua-tool-title">
      <div className="grid gap-7 lg:grid-cols-[1fr_.72fr] lg:items-start">
        <div>
          <p className="mystic-kicker">Mei Hua Yi Shu · Current-Time Casting</p>
          <h2 id="mei-hua-tool-title" className="mt-2 font-display text-3xl font-normal tracking-[-.03em]">Cast from the current moment</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">Confirm the timezone that should define your local civil time. The instant is fixed when you cast and remains fixed for this browser session.</p>
        </div>
        <div className="relative mx-auto grid h-40 w-40 place-items-center rounded-full border border-[rgba(232,198,122,.22)] bg-[radial-gradient(circle,rgba(143,112,255,.16),transparent_68%)] shadow-[0_0_55px_rgba(143,112,255,.12)]" aria-hidden="true">
          <div className="absolute inset-3 rounded-full border border-dashed border-[rgba(137,233,227,.25)] [animation:bridge-spin_16s_linear_infinite]" />
          <span className="font-display text-6xl font-normal text-[var(--gold)]">◷</span>
        </div>
      </div>

      <div className="mt-7 max-w-2xl">
        <label htmlFor="mei-hua-timezone" className="block text-sm font-semibold text-[var(--ink)]">IANA timezone</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input id="mei-hua-timezone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} disabled={Boolean(cast)} spellCheck={false} className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/[0.12] bg-white/[0.035] px-4 py-2 font-mono text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-3)] focus:border-[var(--gold)] disabled:opacity-70" aria-describedby="mei-hua-timezone-help mei-hua-error" />
          <button type="button" onClick={castCurrentTime} disabled={Boolean(cast)} className="mystic-button">Cast current time</button>
        </div>
        <p id="mei-hua-timezone-help" className="mt-2 text-xs leading-6 text-[var(--ink-3)]">Timezone conversion uses the browser’s IANA timezone data, including daylight-saving transitions where applicable.</p>
        {error ? <p id="mei-hua-error" role="alert" className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}
      </div>

      <div className="mystic-card-soft mt-7 min-w-0 p-5 text-sm leading-7 text-[var(--ink-2)] sm:p-6">
        <p className="mystic-kicker">Convention</p>
        <h3 className="mt-2 font-display text-xl font-normal text-[var(--ink)]">Convention used in Public V1</h3>
        <p className="mt-3">Quick I Ching uses <code className="break-all text-[var(--gold-2)]">{MEI_HUA_CONVENTION_ID}</code>: a Gregorian civil-date current-time convention. The Gregorian year is converted to its 1–12 terrestrial-branch number; Gregorian month and day are used directly; the local hour is converted to the 12 earthly branches. Zi hour is 23:00–00:59, with 23:00 using the next Gregorian formula date.</p>
        <p className="mt-2">This convention does <strong>not</strong> use a lunar calendar or lunar leap months, so it is not presented as the only traditional Mei Hua calendar convention. Gregorian leap days are handled normally, and the chosen IANA timezone determines the local date and DST offset.</p>
      </div>

      {calculation ? (
        <div className="mystic-card-soft mt-7 min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="mystic-kicker">Moment locked</p><h3 className="mt-2 font-display text-xl font-normal">Recorded calculation</h3></div>
            <button type="button" onClick={reset} className="mystic-button-secondary">New reading</button>
          </div>
          <dl className="mt-5 grid min-w-0 gap-x-6 gap-y-3 text-sm text-[var(--ink-2)] sm:grid-cols-2">
            <div className="flex min-w-0 justify-between gap-4 border-b border-white/[0.06] pb-2"><dt className="shrink-0">Timezone</dt><dd className="min-w-0 break-all text-right font-mono text-[var(--gold-2)]">{String(calculation.ianaTimeZone)}</dd></div>
            <div className="flex min-w-0 justify-between gap-4 border-b border-white/[0.06] pb-2"><dt className="shrink-0">Formula date</dt><dd className="text-right font-mono text-[var(--gold-2)]">{String(calculation.year)}-{String(calculation.month).padStart(2, "0")}-{String(calculation.day).padStart(2, "0")}</dd></div>
            <div className="flex min-w-0 justify-between gap-4 border-b border-white/[0.06] pb-2"><dt className="shrink-0">Local hour</dt><dd className="text-right font-mono text-[var(--gold-2)]">{String(calculation.hour).padStart(2, "0")}:xx</dd></div>
            <div className="flex min-w-0 justify-between gap-4 border-b border-white/[0.06] pb-2"><dt className="shrink-0">Year / hour branch</dt><dd className="text-right font-mono text-[var(--gold-2)]">{String(calculation.yearBranchNumber)} / {String(calculation.hourBranch)}</dd></div>
            <div className="flex min-w-0 justify-between gap-4 border-b border-white/[0.06] pb-2"><dt className="shrink-0">Upper / lower trigram no.</dt><dd className="text-right font-mono text-[var(--gold-2)]">{String(calculation.upperTrigramNumber)} / {String(calculation.lowerTrigramNumber)}</dd></div>
            <div className="flex min-w-0 justify-between gap-4 border-b border-white/[0.06] pb-2"><dt className="shrink-0">Changing line</dt><dd className="text-right font-mono text-[var(--gold-2)]">{String(calculation.movingLinePosition)}</dd></div>
          </dl>
        </div>
      ) : null}

      {result ? <ReadingResult result={result} /> : null}
    </section>
  );
}
