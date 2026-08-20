"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicReadingResult } from "@/components/public-reading/public-reading-result";
import { useQuestionFirstContext } from "@/components/public-reading/question-first";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import type { UiDictionary } from "@/i18n/dictionaries/types";
import { MEI_HUA_CONVENTION_ID, meiHuaFromUtc } from "@/domain/casting/mei-hua/algorithm";
import { buildPublicReading } from "@/domain/public-reading/reading";
import type { LocalizedReadingContent } from "@/content/mei-hua-yi-shu/types";
import { clearPublicReadingSession, readPublicReadingSession, writePublicReadingSession } from "@/lib/public-reading-session";

const STORAGE_KEY = "quickiching:public-v1:mei-hua-v2";

type StoredCast = { utcMillis: number; ianaTimeZone: string };
type MeiHuaSessionData = { cast: StoredCast };
type ConventionContent = { paragraphs: readonly string[]; bullets?: readonly string[] };

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

function parseStoredCast(value: unknown): StoredCast | null {
  const candidate = value && typeof value === "object" && "cast" in value
    ? (value as { cast?: unknown }).cast
    : value;
  if (!candidate || typeof candidate !== "object") return null;
  const parsed = candidate as Partial<StoredCast>;
  if (!Number.isFinite(parsed.utcMillis) || typeof parsed.ianaTimeZone !== "string" || !validTimeZone(parsed.ianaTimeZone)) return null;
  return { utcMillis: Number(parsed.utcMillis), ianaTimeZone: parsed.ianaTimeZone };
}

function readMeiHuaSession() {
  try {
    return readPublicReadingSession(STORAGE_KEY, (value): MeiHuaSessionData | null => {
      const cast = parseStoredCast(value);
      return cast ? { cast } : null;
    });
  } catch {
    return null;
  }
}

export function MeiHuaTool({
  question: questionProp,
  onNewReading: onNewReadingProp,
  dictionary = EN_UI_DICTIONARY,
  readingContent,
  conventionContent,
}: {
  question?: string;
  onNewReading?: () => void;
  dictionary?: UiDictionary;
  readingContent?: LocalizedReadingContent;
  conventionContent?: ConventionContent;
}) {
  const questionContext = useQuestionFirstContext();
  const question = questionProp ?? questionContext?.question;
  const onNewReading = onNewReadingProp ?? questionContext?.restartQuestion;
  const [timeZone, setTimeZone] = useState("UTC");
  const [cast, setCast] = useState<StoredCast | null>(null);
  const [readingMeta, setReadingMeta] = useState<{ id: string; createdAt: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const session = readMeiHuaSession();
    const stored = session?.data?.cast ?? null;
    if (stored) {
      setCast(stored);
      try {
        const migrated = writePublicReadingSession(STORAGE_KEY, { cast: stored });
        setReadingMeta({ id: migrated.id, createdAt: migrated.createdAt });
      } catch {
        setReadingMeta(session ? { id: session.id, createdAt: session.createdAt } : null);
      }
      setTimeZone(stored.ianaTimeZone);
    } else {
      setReadingMeta(session ? { id: session.id, createdAt: session.createdAt } : null);
      setTimeZone(detectedTimeZone());
    }
  }, []);

  const meiHua = useMemo(() => {
    if (!cast) return null;
    return meiHuaFromUtc(cast.utcMillis, cast.ianaTimeZone);
  }, [cast]);

  const publicReading = useMemo(() => meiHua && readingMeta
    ? buildPublicReading({
        id: readingMeta.id,
        createdAt: readingMeta.createdAt,
        method: "mei-hua-yi-shu",
        methodVersion: meiHua.algorithmVersion,
        question,
        lineValuesBottomUp: meiHua.lineValuesBottomUp,
        evidence: { kind: "mei-hua-yi-shu", calculation: meiHua },
      })
    : null, [meiHua, question, readingMeta]);

  function castCurrentTime() {
    const zone = timeZone.trim();
    if (!validTimeZone(zone)) {
      setError(dictionary.meiHua.invalidTimezone);
      return;
    }
    const next = { utcMillis: Date.now(), ianaTimeZone: zone };
    const session = writePublicReadingSession(STORAGE_KEY, { cast: next });
    setReadingMeta({ id: session.id, createdAt: session.createdAt });
    setError("");
    setCast(next);
  }

  function reset() {
    try {
      clearPublicReadingSession(STORAGE_KEY);
    } catch {
      // The in-memory reset still gives the user a clean new reading.
    }
    setReadingMeta(null);
    setCast(null);
    setError("");
    setTimeZone(detectedTimeZone());
    onNewReading?.();
  }

  const calculation = meiHua?.methodCalculation;

  return (
    <section className="mystic-card overflow-hidden p-5 sm:p-8" aria-labelledby="mei-hua-tool-title">
      <div className="grid gap-7 lg:grid-cols-[1fr_.72fr] lg:items-start">
        <div>
          <p className="mystic-kicker">{dictionary.meiHua.kicker}</p>
          <h2 id="mei-hua-tool-title" className="mt-2 font-display text-3xl font-normal tracking-[-.03em]">{dictionary.meiHua.heading}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">{dictionary.meiHua.description}</p>
        </div>
        <div className="relative mx-auto grid h-40 w-40 place-items-center rounded-full border border-[rgba(232,198,122,.22)] bg-[radial-gradient(circle,rgba(143,112,255,.16),transparent_68%)] shadow-[0_0_55px_rgba(143,112,255,.12)]" aria-hidden="true">
          <div className="absolute inset-3 rounded-full border border-dashed border-[rgba(137,233,227,.25)] [animation:bridge-spin_16s_linear_infinite]" />
          <span className="font-display text-6xl font-normal text-[var(--gold)]">◷</span>
        </div>
      </div>

      <div className="mt-7 max-w-2xl">
        <label htmlFor="mei-hua-timezone" className="block text-sm font-semibold text-[var(--ink)]">{dictionary.meiHua.timezoneLabel}</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input id="mei-hua-timezone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} disabled={Boolean(cast)} spellCheck={false} className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/[0.12] bg-white/[0.035] px-4 py-2 font-mono text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-3)] focus:border-[var(--gold)] disabled:opacity-70" aria-describedby="mei-hua-timezone-help mei-hua-error" />
          <button type="button" onClick={castCurrentTime} disabled={Boolean(cast)} className="mystic-button">{dictionary.meiHua.castButton}</button>
        </div>
        <p id="mei-hua-timezone-help" className="mt-2 text-xs leading-6 text-[var(--ink-3)]">{dictionary.meiHua.timezoneHelp}</p>
        {error ? <p id="mei-hua-error" role="alert" className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}
      </div>

      <div className="mystic-card-soft mt-7 min-w-0 p-5 text-sm leading-7 text-[var(--ink-2)] sm:p-6">
        <p className="mystic-kicker">{dictionary.meiHua.conventionKicker}</p>
        <h3 className="mt-2 font-display text-xl font-normal text-[var(--ink)]">{dictionary.meiHua.conventionHeading}</h3>
        {conventionContent ? conventionContent.paragraphs.map((paragraph) => <p key={paragraph} className="mt-3">{paragraph}</p>) : (
          <>
            <p className="mt-3">Quick I Ching uses <code className="break-all text-[var(--gold-2)]">{MEI_HUA_CONVENTION_ID}</code>: a Gregorian civil-date current-time convention. The Gregorian year is converted to its 1–12 terrestrial-branch number; Gregorian month and day are used directly; the local hour is converted to the 12 earthly branches. Zi hour is 23:00–00:59, with 23:00 using the next Gregorian formula date.</p>
            <p className="mt-2">This convention does <strong>not</strong> use a lunar calendar or lunar leap months, so it is not presented as the only traditional Mei Hua calendar convention. Gregorian leap days are handled normally, and the chosen IANA timezone determines the local date and DST offset.</p>
          </>
        )}
        {conventionContent?.bullets ? <ul className="mt-3 list-disc space-y-1 pl-5">{conventionContent.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
      </div>

      {calculation ? (
        <div className="mystic-card-soft mt-7 min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="mystic-kicker">{dictionary.meiHua.momentLocked}</p><h3 className="mt-2 font-display text-xl font-normal">{dictionary.meiHua.recordedCalculation}</h3></div>
            <button type="button" onClick={reset} className="mystic-button-secondary">{dictionary.meiHua.newReading}</button>
          </div>
          <dl className="mt-5 grid min-w-0 gap-x-6 gap-y-3 text-sm text-[var(--ink-2)] sm:grid-cols-2">
            <div className="flex min-w-0 justify-between gap-4 border-b border-white/[0.06] pb-2"><dt className="shrink-0">{dictionary.meiHua.timezone}</dt><dd className="min-w-0 break-all text-right font-mono text-[var(--gold-2)]">{String(calculation.ianaTimeZone)}</dd></div>
            <div className="flex min-w-0 justify-between gap-4 border-b border-white/[0.06] pb-2"><dt className="shrink-0">{dictionary.meiHua.formulaDate}</dt><dd className="text-right font-mono text-[var(--gold-2)]">{String(calculation.year)}-{String(calculation.month).padStart(2, "0")}-{String(calculation.day).padStart(2, "0")}</dd></div>
            <div className="flex min-w-0 justify-between gap-4 border-b border-white/[0.06] pb-2"><dt className="shrink-0">{dictionary.meiHua.localHour}</dt><dd className="text-right font-mono text-[var(--gold-2)]">{String(calculation.hour).padStart(2, "0")}:xx</dd></div>
            <div className="flex min-w-0 justify-between gap-4 border-b border-white/[0.06] pb-2"><dt className="shrink-0">{dictionary.meiHua.branch}</dt><dd className="text-right font-mono text-[var(--gold-2)]">{String(calculation.yearBranchNumber)} / {String(calculation.hourBranch)}</dd></div>
            <div className="flex min-w-0 justify-between gap-4 border-b border-white/[0.06] pb-2"><dt className="shrink-0">{dictionary.meiHua.trigram}</dt><dd className="text-right font-mono text-[var(--gold-2)]">{String(calculation.upperTrigramNumber)} / {String(calculation.lowerTrigramNumber)}</dd></div>
            <div className="flex min-w-0 justify-between gap-4 border-b border-white/[0.06] pb-2"><dt className="shrink-0">{dictionary.meiHua.changingLine}</dt><dd className="text-right font-mono text-[var(--gold-2)]">{String(calculation.movingLinePosition)}</dd></div>
          </dl>
        </div>
      ) : null}

      {publicReading ? <PublicReadingResult reading={publicReading} onNewReading={reset} dictionary={dictionary} localizedContent={readingContent} /> : null}
    </section>
  );
}
