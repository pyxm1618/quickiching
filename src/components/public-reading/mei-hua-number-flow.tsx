"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicReadingResult } from "@/components/public-reading/public-reading-result";
import { meiHuaFromUtc, type MeiHuaResult } from "@/domain/casting/mei-hua/algorithm";
import {
  MEI_HUA_NUMBER_TIME_ALGORITHM_STATUS,
  MEI_HUA_NUMBER_TIME_INPUT_VERSION,
  parseMeiHuaNumber,
  tryMeiHuaFromNumberAndTime,
  validIanaTimeZone,
  type MeiHuaNumberTimeInput,
} from "@/domain/casting/mei-hua/number-time";
import { buildPublicReading } from "@/domain/public-reading/reading";
import { normalizePublicQuestion, PUBLIC_QUESTION_MAX_CODE_POINTS } from "@/domain/public-reading/question";
import type { PublicReading } from "@/domain/public-reading/types";
import {
  clearPublicReadingSession,
  patchPublicReadingSession,
  readPublicReadingSession,
  writePublicReadingSession,
} from "@/lib/public-reading-session";

const STORAGE_KEY = "quickiching:public-v1:mei-hua-number-time-v1";
const LEGACY_STORAGE_KEY = "quickiching:public-v1:mei-hua-v2";

type FlowStep = 1 | 2 | 3 | 4 | "reading";

type StoredNumberTimeCast = {
  mode: "number-time";
  inputVersion: typeof MEI_HUA_NUMBER_TIME_INPUT_VERSION;
  input: MeiHuaNumberTimeInput;
  algorithmStatus: typeof MEI_HUA_NUMBER_TIME_ALGORITHM_STATUS | "complete";
  result?: MeiHuaResult;
};

type LegacyStoredCast = {
  utcMillis: number;
  ianaTimeZone: string;
};

function detectedTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return validIanaTimeZone(zone) ? zone : "UTC";
}

function isMeiHuaResult(value: unknown): value is MeiHuaResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<MeiHuaResult>;
  return Array.isArray(result.lineValuesBottomUp)
    && result.lineValuesBottomUp.length === 6
    && result.lineValuesBottomUp.every((line) => line === 6 || line === 7 || line === 8 || line === 9)
    && typeof result.algorithmVersion === "string"
    && Number.isInteger(result.movingLinePosition);
}

function parseNumberTimeCast(value: unknown): StoredNumberTimeCast | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as {
    mode?: unknown;
    inputVersion?: unknown;
    input?: unknown;
    algorithmStatus?: unknown;
    result?: unknown;
  };
  if (candidate.mode !== "number-time" || candidate.inputVersion !== MEI_HUA_NUMBER_TIME_INPUT_VERSION) return null;
  if (!candidate.input || typeof candidate.input !== "object") return null;
  const input = candidate.input as Partial<MeiHuaNumberTimeInput>;
  if (!Number.isSafeInteger(input.number)
    || !Number.isFinite(input.utcMillis)
    || typeof input.ianaTimeZone !== "string"
    || !validIanaTimeZone(input.ianaTimeZone)) return null;
  if (candidate.algorithmStatus !== "unverified" && candidate.algorithmStatus !== "complete") return null;
  if (candidate.result !== undefined && !isMeiHuaResult(candidate.result)) return null;
  return {
    mode: "number-time",
    inputVersion: MEI_HUA_NUMBER_TIME_INPUT_VERSION,
    input: {
      number: Number(input.number),
      utcMillis: Number(input.utcMillis),
      ianaTimeZone: input.ianaTimeZone,
    },
    algorithmStatus: candidate.algorithmStatus,
    ...(candidate.result ? { result: candidate.result } : {}),
  };
}

function parseLegacyCast(value: unknown): LegacyStoredCast | null {
  const candidate = value && typeof value === "object" && "cast" in value
    ? (value as { cast?: unknown }).cast
    : value;
  if (!candidate || typeof candidate !== "object") return null;
  const cast = candidate as Partial<LegacyStoredCast>;
  if (!Number.isFinite(cast.utcMillis)
    || typeof cast.ianaTimeZone !== "string"
    || !validIanaTimeZone(cast.ianaTimeZone)) return null;
  return { utcMillis: Number(cast.utcMillis), ianaTimeZone: cast.ianaTimeZone };
}

function formatDate(utcMillis: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone,
  }).format(new Date(utcMillis));
}

function formatTime(utcMillis: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(utcMillis));
}

function readingFromCast(
  id: string,
  question: string | undefined,
  cast: StoredNumberTimeCast,
): PublicReading | null {
  if (!cast.result) return null;
  return buildPublicReading({
    id,
    createdAt: new Date(cast.input.utcMillis).toISOString(),
    method: "mei-hua-yi-shu",
    methodVersion: cast.result.algorithmVersion,
    question,
    lineValuesBottomUp: cast.result.lineValuesBottomUp,
    evidence: { kind: "mei-hua-yi-shu", calculation: cast.result },
  });
}

export function MeiHuaNumberFlow() {
  const [step, setStep] = useState<FlowStep>(1);
  const [question, setQuestion] = useState<string | undefined>();
  const [questionDraft, setQuestionDraft] = useState("");
  const [numberDraft, setNumberDraft] = useState("");
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [cast, setCast] = useState<StoredNumberTimeCast | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [legacyReading, setLegacyReading] = useState<PublicReading | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");

  useEffect(() => {
    const current = readPublicReadingSession(STORAGE_KEY, parseNumberTimeCast);
    if (current) {
      setSessionId(current.id);
      const restoredQuestion = current.coreQuestionAtCast ?? current.question;
      setQuestion(restoredQuestion);
      setQuestionDraft(restoredQuestion ?? "");
      if (current.data) {
        setCast(current.data);
        setSelectedNumber(current.data.input.number);
        setNumberDraft(String(current.data.input.number));
        setStep(4);
      } else if (current.question) {
        setStep(2);
      }
      return;
    }

    const legacy = readPublicReadingSession(LEGACY_STORAGE_KEY, (value) => {
      const restored = parseLegacyCast(value);
      return restored ? { cast: restored } : null;
    });
    const legacyCast = legacy?.data?.cast;
    if (!legacy || !legacyCast) return;

    const legacyQuestion = legacy.coreQuestionAtCast ?? legacy.question;
    const result = meiHuaFromUtc(legacyCast.utcMillis, legacyCast.ianaTimeZone);
    setLegacyReading(buildPublicReading({
      id: legacy.id,
      createdAt: new Date(legacyCast.utcMillis).toISOString(),
      method: "mei-hua-yi-shu",
      methodVersion: result.algorithmVersion,
      question: legacyQuestion,
      lineValuesBottomUp: result.lineValuesBottomUp,
      evidence: { kind: "mei-hua-yi-shu", calculation: result },
    }));
  }, []);

  useEffect(() => {
    if (step !== 3) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const timeZone = useMemo(detectedTimeZone, []);
  const publicReading = useMemo(
    () => cast && sessionId ? readingFromCast(sessionId, question, cast) : null,
    [cast, question, sessionId],
  );

  function submitQuestion() {
    try {
      const normalized = normalizePublicQuestion(questionDraft);
      if (!normalized) {
        setError("Enter one core question before continuing.");
        return;
      }
      if (!patchPublicReadingSession(STORAGE_KEY, { started: true, question: normalized })) {
        setError("This question could not be saved.");
        return;
      }
      setQuestion(normalized);
      setQuestionDraft(normalized);
      setSelectedNumber(null);
      setNumberDraft("");
      setError("");
      setStep(2);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error && nextError.message === "PUBLIC_QUESTION_TOO_LONG"
        ? `Keep the question within ${PUBLIC_QUESTION_MAX_CODE_POINTS} Unicode characters.`
        : "This question could not be saved.");
    }
  }

  function changeQuestion() {
    setSelectedNumber(null);
    setNumberDraft("");
    setError("");
    setStep(1);
  }

  function submitNumber() {
    try {
      const nextNumber = parseMeiHuaNumber(numberDraft);
      setSelectedNumber(nextNumber);
      setNumberDraft(String(nextNumber));
      setError("");
      setStep(3);
    } catch {
      setError("Enter a whole number before continuing.");
    }
  }

  function changeNumber() {
    setError("");
    setStep(2);
  }

  function confirmAndCast() {
    if (!question || selectedNumber === null) return;
    const utcMillis = Date.now();
    const input: MeiHuaNumberTimeInput = {
      number: selectedNumber,
      utcMillis,
      ianaTimeZone: timeZone,
    };

    try {
      const result = tryMeiHuaFromNumberAndTime(input);
      const nextCast: StoredNumberTimeCast = {
        mode: "number-time",
        inputVersion: MEI_HUA_NUMBER_TIME_INPUT_VERSION,
        input,
        algorithmStatus: result ? "complete" : MEI_HUA_NUMBER_TIME_ALGORITHM_STATUS,
        ...(result ? { result } : {}),
      };
      const session = writePublicReadingSession(STORAGE_KEY, nextCast);
      setSessionId(session.id);
      setQuestion(session.coreQuestionAtCast ?? session.question ?? question);
      setCast(nextCast);
      setError("");
      setStep(4);
    } catch {
      setError("This cast could not be locked. No official cast was created.");
    }
  }

  function viewReading() {
    if (!publicReading) return;
    setStep("reading");
  }

  function startNewReading() {
    try {
      clearPublicReadingSession(STORAGE_KEY);
      clearPublicReadingSession(LEGACY_STORAGE_KEY);
    } catch {
      // Reset the in-memory flow even if browser storage is unavailable.
    }
    setQuestion(undefined);
    setQuestionDraft("");
    setNumberDraft("");
    setSelectedNumber(null);
    setCast(null);
    setSessionId(null);
    setLegacyReading(null);
    setError("");
    setStep(1);
  }

  if (legacyReading) {
    return (
      <div data-mei-hua-flow data-mei-hua-legacy-restored>
        <PublicReadingResult reading={legacyReading} onNewReading={startNewReading} />
      </div>
    );
  }

  if (step === "reading" && publicReading) {
    return (
      <div data-mei-hua-flow data-mei-hua-shared-reading>
        <PublicReadingResult reading={publicReading} onNewReading={startNewReading} />
      </div>
    );
  }

  return (
    <section className="mystic-card p-5 sm:p-8" data-mei-hua-flow data-mei-hua-step={step}>
      {step === 1 ? (
        <div>
          <p className="mystic-kicker">Step 1 of 4</p>
          <h2 className="mt-2 font-display text-3xl font-normal">Ask Your Question</h2>
          <label htmlFor="mei-hua-question" className="mt-6 block text-sm font-semibold">Your Question</label>
          <textarea
            id="mei-hua-question"
            value={questionDraft}
            onChange={(event) => setQuestionDraft(event.target.value)}
            rows={3}
            maxLength={PUBLIC_QUESTION_MAX_CODE_POINTS}
            data-private-question="true"
            data-clarity-mask="true"
            className="mt-2 min-h-28 w-full resize-y rounded-2xl border border-white/[0.12] bg-white/[0.035] px-4 py-3 text-sm leading-7"
          />
          <div className="mt-5">
            <button type="button" className="mystic-button" onClick={submitQuestion}>Continue</button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <p className="mystic-kicker">Step 2 of 4</p>
          <h2 className="mt-2 font-display text-3xl font-normal">Choose a Number</h2>
          <p className="mt-4 text-sm leading-7" data-private-question="true"><strong>Your Question:</strong> {question}</p>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-2)]">Keep your question in mind and enter the first number that comes to you. Don’t calculate or overthink it.</p>
          <label htmlFor="mei-hua-number" className="mt-6 block text-sm font-semibold">Your Number</label>
          <input
            id="mei-hua-number"
            type="text"
            inputMode="numeric"
            value={numberDraft}
            onChange={(event) => setNumberDraft(event.target.value)}
            className="mt-2 min-h-12 w-full max-w-xs rounded-2xl border border-white/[0.12] bg-white/[0.035] px-4 py-2"
          />
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="mystic-button" onClick={submitNumber}>Continue</button>
            <button type="button" className="mystic-button-secondary" onClick={changeQuestion}>Change Question</button>
          </div>
        </div>
      ) : null}

      {step === 3 && selectedNumber !== null ? (
        <div>
          <p className="mystic-kicker">Step 3 of 4</p>
          <h2 className="mt-2 font-display text-3xl font-normal">Confirm Your Number</h2>
          <p className="mt-4 text-sm leading-7" data-private-question="true"><strong>Your Question:</strong> {question}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Your Number and This Moment">
            <div className="mystic-card-soft p-4">
              <p className="mystic-kicker">Your Number</p>
              <p className="mt-2 font-display text-3xl">{selectedNumber}</p>
            </div>
            <div className="mystic-card-soft p-4">
              <p className="mystic-kicker">This Moment</p>
              <dl className="mt-2 space-y-2 text-sm">
                <div><dt className="font-semibold">Current Date</dt><dd>{formatDate(now, timeZone)}</dd></div>
                <div><dt className="font-semibold">Local Time</dt><dd>{formatTime(now, timeZone)}</dd></div>
                <div><dt className="font-semibold">Time Zone</dt><dd>{timeZone}</dd></div>
              </dl>
            </div>
          </div>
          <p className="mt-4 text-xs leading-6 text-[var(--ink-3)]">The official cast time is recorded only when you click Confirm &amp; Cast.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="mystic-button" onClick={confirmAndCast}>Confirm &amp; Cast</button>
            <button type="button" className="mystic-button-secondary" onClick={changeNumber}>Change Number</button>
            <button type="button" className="mystic-button-secondary" onClick={changeQuestion}>Change Question</button>
          </div>
        </div>
      ) : null}

      {step === 4 && cast ? (
        <div data-mei-hua-locked="true">
          <p className="mystic-kicker">Step 4 of 4</p>
          <h2 className="mt-2 font-display text-3xl font-normal">Cast Result</h2>
          <section className="mt-6">
            <p className="mystic-kicker">Your Question</p>
            <p className="mt-2 text-sm leading-7" data-private-question="true">{question}</p>
          </section>

          {publicReading ? (
            <dl className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="mystic-card-soft p-4"><dt className="mystic-kicker">Primary Hexagram</dt><dd className="mt-2 text-lg">Hexagram {publicReading.primaryHexagram}</dd></div>
              <div className="mystic-card-soft p-4"><dt className="mystic-kicker">Changing Line</dt><dd className="mt-2 text-lg">{publicReading.changingLines.length ? `Line ${publicReading.changingLines.join(", ")}` : "None"}</dd></div>
              <div className="mystic-card-soft p-4"><dt className="mystic-kicker">Relating Hexagram</dt><dd className="mt-2 text-lg">{publicReading.relatingHexagram ? `Hexagram ${publicReading.relatingHexagram}` : "None"}</dd></div>
            </dl>
          ) : (
            <div className="mystic-card-soft mt-6 p-5" data-mei-hua-algorithm-boundary="unverified">
              <p className="font-semibold">Hexagram calculation is not yet available for this locked cast.</p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">The repository does not yet contain an approved one-number + time Mei Hua algorithm. Your question, number, exact cast time, and timezone are sealed, but no hexagram has been fabricated.</p>
            </div>
          )}

          <details className="mt-6 text-sm">
            <summary className="cursor-pointer font-semibold">Cast Details</summary>
            <dl className="mt-3 grid gap-2 text-[var(--ink-2)]">
              <div><dt className="font-semibold">Number</dt><dd>{cast.input.number}</dd></div>
              <div><dt className="font-semibold">Current Date</dt><dd>{formatDate(cast.input.utcMillis, cast.input.ianaTimeZone)}</dd></div>
              <div><dt className="font-semibold">Local Time</dt><dd>{formatTime(cast.input.utcMillis, cast.input.ianaTimeZone)}</dd></div>
              <div><dt className="font-semibold">Time Zone</dt><dd>{cast.input.ianaTimeZone}</dd></div>
            </dl>
          </details>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="mystic-button" onClick={viewReading} disabled={!publicReading} data-mei-hua-view-reading>
              View Reading
            </button>
            {!publicReading ? <button type="button" className="mystic-button-secondary" onClick={startNewReading}>Start New Reading</button> : null}
          </div>
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
    </section>
  );
}
