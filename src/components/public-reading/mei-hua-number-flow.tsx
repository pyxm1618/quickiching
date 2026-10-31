"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock3, MapPin } from "lucide-react";
import "./mei-hua-scene.css";
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

type FlowStep = 1 | 2 | 3 | "reading";

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
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit",
    timeZone,
  }).format(new Date(utcMillis));
}

function formatTime(utcMillis: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
    hour12: false,
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
    try {
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
          setStep("reading");
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
    } catch {
      setError("Browser session storage is unavailable. No cast has been created.");
    }
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
      if (normalized !== question) {
        setSelectedNumber(null);
        setNumberDraft("");
      }
      setError("");
      setStep(2);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error && nextError.message === "PUBLIC_QUESTION_TOO_LONG"
        ? `Keep the question within ${PUBLIC_QUESTION_MAX_CODE_POINTS} Unicode characters.`
        : "This question could not be saved.");
    }
  }

  function changeQuestion() {
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
      setStep("reading");
    } catch {
      setError("This cast could not be locked. No official cast was created.");
    }
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

  if (step === "reading" && cast) {
    return (
      <div data-mei-hua-flow data-mei-hua-shared-reading data-mei-hua-locked="true">
        {publicReading ? <PublicReadingResult reading={publicReading} onNewReading={startNewReading} /> : (
          <section className="mei-scene mei-blocked" data-mei-hua-algorithm-boundary="unverified">
            <SceneBook />
            <div className="mei-blocked-copy">
              <h1>Your Question</h1>
              <p data-private-question="true" data-clarity-mask="true">{question}</p>
              <h2>Hexagram calculation is not yet available for this locked cast.</h2>
              <p>The approved number + time algorithm is unavailable. Your question, number, exact cast time, and timezone are locked.</p>
              <dl><div><dt>Your Number</dt><dd>{cast.input.number}</dd></div><div><dt>UTC timestamp</dt><dd>{new Date(cast.input.utcMillis).toISOString()}</dd></div><div><dt>Time Zone</dt><dd>{cast.input.ianaTimeZone}</dd></div></dl>
              <button type="button" className="mei-button" onClick={startNewReading}>New Reading</button>
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <section className={`mei-scene mei-step-${step}`} data-mei-hua-flow data-mei-hua-step={step} aria-label="Mei Hua Yi Shu">
      <SceneBook />
      {step !== 1 ? <div className="mei-question-summary" data-private-question="true" data-clarity-mask="true">
        <span>Your question</span><p>{question}</p><button type="button" onClick={changeQuestion}>✎ Edit</button>
      </div> : null}
      {step === 1 ? <form className="mei-ask" onSubmit={(event) => { event.preventDefault(); submitQuestion(); }}>
        <header className="mei-heading"><h1>Mei Hua Yi Shu</h1><p>One thought. One hexagram. A reflection of what matters now.</p></header>
        <div className="mei-question-scroll">
          <label htmlFor="mei-hua-question">What would you like to ask?</label>
          <textarea id="mei-hua-question" value={questionDraft} onChange={(event) => setQuestionDraft(event.target.value)}
            rows={2} maxLength={PUBLIC_QUESTION_MAX_CODE_POINTS} placeholder="Enter a specific question that is on your mind..."
            data-private-question="true" data-clarity-mask="true" />
          <button type="submit" className="mei-button mei-button-red"><span aria-hidden="true">☯</span>Continue</button>
        </div>
      </form> : null}
      {step === 2 ? <form className="mei-choose" onSubmit={(event) => { event.preventDefault(); submitNumber(); }}>
        <header className="mei-heading"><h1>Mei Hua Yi Shu</h1><p>One thought. One hexagram. A reflection of what matters now.</p></header>
        <h2>Choose a Number</h2>
        <p className="mei-number-copy">Keep your question in mind and enter the first number that comes to you. Don’t calculate or overthink it.</p>
        <div className="mei-number-decoration">
          <label className="sr-only" htmlFor="mei-hua-number">Your Number</label>
          <input id="mei-hua-number" type="text" inputMode="numeric" autoComplete="off" value={numberDraft} onChange={(event) => setNumberDraft(event.target.value)} />
        </div>
        <button type="submit" className="mei-button"><span aria-hidden="true">☯</span>Continue</button>
      </form> : null}
      {step === 3 && selectedNumber !== null ? <div className="mei-confirm">
        <h1>Confirm Your Number</h1>
        <p className="mei-confirm-copy">Once confirmed, this number and this moment will be locked for this reading.</p>
        <div className="mei-confirm-cards" aria-label="Your Number and This Moment">
          <section className="mei-number-ring"><h2>Your Number</h2><p>{selectedNumber}</p></section>
          <section className="mei-moment"><h2>This Moment</h2><dl>
            <div><dt><CalendarDays aria-hidden="true" />Current Date</dt><dd>{formatDate(now, timeZone)}</dd></div>
            <div><dt><Clock3 aria-hidden="true" />Local Time</dt><dd>{formatTime(now, timeZone)}</dd></div>
            <div><dt><MapPin aria-hidden="true" />Time Zone</dt><dd>{timeZone}</dd></div>
          </dl></section>
        </div>
        <div className="mei-confirm-actions"><button type="button" className="mei-button mei-button-outline" onClick={changeNumber}>Change Number</button><button type="button" className="mei-button" onClick={confirmAndCast}><span aria-hidden="true">☯</span>Confirm &amp; Cast</button></div>
      </div> : null}
      {error ? <p role="alert" className="mei-error">{error}</p> : null}
    </section>
  );
}

function SceneBook() {
  return <Link href="/" className="mei-scene-book" aria-label="Return to Quick I Ching" title="Return to Quick I Ching"><img src="/mei-hua/navigation-book.webp" alt="Quick I Ching" width="1536" height="1024" /><span>Return to Quick I Ching</span></Link>;
}
