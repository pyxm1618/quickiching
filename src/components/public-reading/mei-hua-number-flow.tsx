"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock3, MapPin } from "lucide-react";
import "./mei-hua-scene.css";
import { completeReadingHandoff, readingHandoffFailureCopy } from "@/lib/reading-handoff";
import { MEI_HUA_SESSION_STORAGE_KEY } from "@/lib/method-session-retirement";
import {
  NO_READING_RESUME,
  decideReadingResume,
  resumeProgressLabel,
  type ReadingResumeState,
} from "@/lib/reading-resume";
import {
  MEI_HUA_NUMBER_TIME_INPUT_VERSION,
  meiHuaFromNumberAndTime,
  parseMeiHuaNumber,
  validIanaTimeZone,
  type MeiHuaNumberTimeInput,
  type MeiHuaNumberTimeResult,
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
import { GildedTitle } from "@/components/typography/gilded-title";

const STORAGE_KEY = MEI_HUA_SESSION_STORAGE_KEY;

type FlowStep = 1 | 2 | 3;

type StoredNumberTimeCast = {
  mode: "number-time";
  inputVersion: typeof MEI_HUA_NUMBER_TIME_INPUT_VERSION;
  input: MeiHuaNumberTimeInput;
  result: MeiHuaNumberTimeResult;
};

type StoredNumberTimeDraft = {
  mode: "number-time-draft";
  inputVersion: typeof MEI_HUA_NUMBER_TIME_INPUT_VERSION;
  step: 2 | 3;
  number?: number;
};

type StoredMeiHuaData = StoredNumberTimeCast | StoredNumberTimeDraft;

function detectedTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return validIanaTimeZone(zone) ? zone : "UTC";
}

function parseNumberTimeData(value: unknown): StoredMeiHuaData | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { mode?: unknown; inputVersion?: unknown; input?: unknown; step?: unknown; number?: unknown };
  if (candidate.inputVersion !== MEI_HUA_NUMBER_TIME_INPUT_VERSION) return null;

  if (candidate.mode === "number-time-draft") {
    if (candidate.step !== 2 && candidate.step !== 3) return null;
    if (candidate.number !== undefined && (!Number.isSafeInteger(candidate.number) || Number(candidate.number) <= 0)) return null;
    if (candidate.step === 3 && candidate.number === undefined) return null;
    return {
      mode: "number-time-draft",
      inputVersion: MEI_HUA_NUMBER_TIME_INPUT_VERSION,
      step: candidate.step,
      ...(candidate.number !== undefined ? { number: Number(candidate.number) } : {}),
    };
  }

  if (candidate.mode !== "number-time" || !candidate.input || typeof candidate.input !== "object") return null;
  const input = candidate.input as Partial<MeiHuaNumberTimeInput>;
  if (!Number.isSafeInteger(input.number) || Number(input.number) <= 0
    || !Number.isSafeInteger(input.utcMillis)
    || typeof input.ianaTimeZone !== "string") return null;
  try {
    const sealedInput = {
      number: Number(input.number),
      utcMillis: Number(input.utcMillis),
      ianaTimeZone: input.ianaTimeZone,
    };
    return {
      mode: "number-time",
      inputVersion: MEI_HUA_NUMBER_TIME_INPUT_VERSION,
      input: sealedInput,
      result: meiHuaFromNumberAndTime(sealedInput),
    };
  } catch {
    return null;
  }
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
): PublicReading {
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

export function MeiHuaNumberFlow({ locale = "en" }: { locale?: "en" | "zh-Hans" }) {
  const router = useRouter();
  const zh = locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  const [step, setStep] = useState<FlowStep>(1);
  const [question, setQuestion] = useState<string | undefined>();
  const [questionDraft, setQuestionDraft] = useState("");
  const [numberDraft, setNumberDraft] = useState("");
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [resumeState, setResumeState] = useState<ReadingResumeState>(NO_READING_RESUME);
  const [resumed, setResumed] = useState(false);
  const [sealedReading, setSealedReading] = useState<PublicReading | null>(null);
  const handoffStartedRef = useRef(false);

  // C1: detect only. Step 1 remains the default entry state.
  useEffect(() => {
    try {
      const current = readPublicReadingSession(STORAGE_KEY, parseNumberTimeData);
      if (!current) return;
      const restoredQuestion = current.coreQuestionAtCast ?? current.question;
      if (current.data?.mode === "number-time") {
        setResumeState(decideReadingResume({
          method: "mei-hua-yi-shu",
          partial: null,
          sealedReadingId: current.id,
        }));
        setSealedReading(readingFromCast(current.id, restoredQuestion, current.data));
        return;
      }
      const draft = current.data;
      const completed = draft?.mode === "number-time-draft" ? draft.step - 1 : 1;
      setResumeState(decideReadingResume({
        method: "mei-hua-yi-shu",
        partial: { completed, total: 3, unit: "steps" },
        partialReadingId: current.id,
        stage: "draft",
      }));
    } catch {
      setError(zh ? "浏览器会话存储不可用，尚未创建正式卦象。" : "Browser session storage is unavailable. No cast has been created.");
    }
  }, [zh]);

  function resume() {
    try {
      const current = readPublicReadingSession(STORAGE_KEY, parseNumberTimeData);
      if (!current) {
        setResumeState(NO_READING_RESUME);
        return;
      }
      setSessionId(current.id);
      const restoredQuestion = current.coreQuestionAtCast ?? current.question;
      setQuestion(restoredQuestion);
      setQuestionDraft(restoredQuestion ?? "");
      if (current.data?.mode === "number-time-draft") {
        setSelectedNumber(current.data.number ?? null);
        setNumberDraft(current.data.number ? String(current.data.number) : "");
        setStep(current.data.step);
      } else if (restoredQuestion) {
        setStep(2);
      }
      setResumed(true);
      setError("");
    } catch {
      setError(zh ? "无法恢复这次起卦。" : "This cast could not be resumed.");
    }
  }

  useEffect(() => {
    if (step !== 3) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const timeZone = useMemo(detectedTimeZone, []);

  function persistDraft(nextStep: 2 | 3, number: number | null) {
    try {
      writePublicReadingSession(STORAGE_KEY, {
        mode: "number-time-draft",
        inputVersion: MEI_HUA_NUMBER_TIME_INPUT_VERSION,
        step: nextStep,
        ...(number ? { number } : {}),
      } satisfies StoredNumberTimeDraft, { freezeQuestion: false });
    } catch {
      // Pre-cast draft persistence is best effort; no cast fact is affected.
    }
  }

  function submitQuestion() {
    try {
      const normalized = normalizePublicQuestion(questionDraft);
      if (!normalized) {
        setError(t("Enter one core question before continuing.", "请先输入一个核心问题。"));
        return;
      }
      if (!patchPublicReadingSession(STORAGE_KEY, { started: true, question: normalized })) {
        setError(t("This question could not be saved.", "无法保存这个问题。"));
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
      persistDraft(2, null);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error && nextError.message === "PUBLIC_QUESTION_TOO_LONG"
        ? t(`Keep the question within ${PUBLIC_QUESTION_MAX_CODE_POINTS} Unicode characters.`, `问题请控制在 ${PUBLIC_QUESTION_MAX_CODE_POINTS} 个 Unicode 字符以内。`)
        : t("This question could not be saved.", "无法保存这个问题。"));
    }
  }

  function changeQuestion() {
    // A changed question is a new reading identity; the locked pre-cast draft is
    // discarded explicitly instead of being silently reused.
    try {
      clearPublicReadingSession(STORAGE_KEY);
    } catch {
      // The in-memory flow still allows editing.
    }
    setSessionId(null);
    setResumeState(NO_READING_RESUME);
    setResumed(false);
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
      persistDraft(3, nextNumber);
    } catch {
      setError(t("Enter a whole number before continuing.", "请输入一个整数后继续。"));
    }
  }

  function changeNumber() {
    setError("");
    setStep(2);
    persistDraft(2, null);
  }

  function confirmAndCast() {
    if (!question || selectedNumber === null) return;
    const utcMillis = Date.now();
    const input: MeiHuaNumberTimeInput = {
      number: selectedNumber,
      utcMillis,
      ianaTimeZone: timeZone,
    };

    let reading: PublicReading;
    let frozenQuestion: string | undefined;
    try {
      const result = meiHuaFromNumberAndTime(input);
      const nextCast: StoredNumberTimeCast = {
        mode: "number-time",
        inputVersion: MEI_HUA_NUMBER_TIME_INPUT_VERSION,
        input,
        result,
      };
      const session = writePublicReadingSession(STORAGE_KEY, nextCast);
      setSessionId(session.id);
      frozenQuestion = session.coreQuestionAtCast ?? session.question ?? question;
      reading = readingFromCast(session.id, frozenQuestion, nextCast);
    } catch {
      setError(t("This cast could not be locked. No official cast was created.", "本次起卦无法锁定，尚未创建正式卦象。"));
      return;
    }

    setQuestion(frozenQuestion ?? question);
    setError("");
    handoffStartedRef.current = true;
    const outcome = completeReadingHandoff({ reading, zh, router });
    if (outcome.kind === "failed") {
      setSealedReading(reading);
      setError(readingHandoffFailureCopy(outcome, zh) ?? "");
      handoffStartedRef.current = false;
    }
  }

  function retrySealedHandoff() {
    if (!sealedReading) return;
    const outcome = completeReadingHandoff({ reading: sealedReading, zh, router });
    if (outcome.kind === "failed") {
      setError(readingHandoffFailureCopy(outcome, zh) ?? "");
      return;
    }
    setError("");
    setSealedReading(null);
  }

  function startNewReading() {
    try {
      clearPublicReadingSession(STORAGE_KEY);
    } catch {
      // Reset the in-memory flow even if browser storage is unavailable.
    }
    setQuestion(undefined);
    setQuestionDraft("");
    setNumberDraft("");
    setSelectedNumber(null);
    setSessionId(null);
    setError("");
    setStep(1);
    setResumeState(NO_READING_RESUME);
    setResumed(false);
    setSealedReading(null);
    handoffStartedRef.current = false;
  }

  if (sealedReading) {
    // C1 / C2: a completed cast is never an editable or resumable casting step.
    return (
      <section className="mei-scene mei-step-3" data-mei-hua-flow data-reading-sealed={sealedReading.id} aria-live="polite">
        <SceneBook zh={zh} />
        <div className="mei-confirm">
          {zh ? <div className="mei-flow-title" role="heading" aria-level={2}>起卦已完成</div> : <h1>Casting Complete</h1>}
          <p className="mei-confirm-copy">
            {error || (zh
              ? "这次起卦已经落定，但还没有进入解卦选择。同一个数字、时刻和卦象会继续沿用。"
              : "This cast is sealed but has not reached Reading Choice yet. The same number, moment, and cast are kept.")}
          </p>
          <div className="mei-confirm-actions">
            <button type="button" className="mei-button" onClick={retrySealedHandoff} data-reading-retry-handoff>
              {zh ? "重试进入解卦" : "Retry Handoff"}
            </button>
            <button type="button" className="mei-button mei-button-outline" onClick={startNewReading} data-reading-start-new>
              {zh ? "重新起卦" : "Start New Reading"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`mei-scene mei-step-${step}`} data-mei-hua-flow data-mei-hua-step={step} aria-label={t("Mei Hua Yi Shu", "梅花易数")}>
      <SceneBook zh={zh} />
      {resumeState.kind === "partial" && !resumed ? (
        <div className="mei-question-summary" data-reading-resume="mei-hua-yi-shu">
          <span>{t("Unfinished cast", "未完成的起卦")}</span>
          <p>{resumeProgressLabel(resumeState, zh)}</p>
          <button type="button" onClick={resume} data-reading-resume-action>{t("Resume", "继续")}</button>
        </div>
      ) : null}
      {step !== 1 ? <div className="mei-question-summary" data-private-question="true" data-clarity-mask="true">
        <span>{t("Your question", "你的问题")}</span><p>{question}</p><button type="button" onClick={changeQuestion}>{t("✎ Edit", "✎ 修改")}</button>
      </div> : null}
      {step === 1 ? <form className="mei-ask" onSubmit={(event) => { event.preventDefault(); submitQuestion(); }}>
        <header className="mei-heading">{zh ? <GildedTitle as="span" size="lg" role="heading" aria-level={2}>梅花易数</GildedTitle> : <GildedTitle as="h1" size="lg">Mei Hua Yi Shu</GildedTitle>}<p>{t("One thought. One hexagram. A reflection of what matters now.", "一念一卦，映照此刻最重要之事。")}</p></header>
        <div className="mei-question-scroll">
          <label htmlFor="mei-hua-question">{t("What would you like to ask?", "你想问什么？")}</label>
          <textarea id="mei-hua-question" value={questionDraft} onChange={(event) => setQuestionDraft(event.target.value)}
            rows={2} maxLength={PUBLIC_QUESTION_MAX_CODE_POINTS} placeholder={t("Enter a specific question that is on your mind...", "请输入一个此刻真正困扰你的具体问题……")}
            data-private-question="true" data-clarity-mask="true" />
          <button type="submit" className="mei-button mei-button-red"><span aria-hidden="true">☯</span>{t("Continue", "继续")}</button>
        </div>
      </form> : null}
      {step === 2 ? <form className="mei-choose" onSubmit={(event) => { event.preventDefault(); submitNumber(); }}>
        <header className="mei-heading">{zh ? <GildedTitle as="span" size="lg" role="heading" aria-level={2}>梅花易数</GildedTitle> : <GildedTitle as="h1" size="lg">Mei Hua Yi Shu</GildedTitle>}<p>{t("One thought. One hexagram. A reflection of what matters now.", "一念一卦，映照此刻最重要之事。")}</p></header>
        <h2>{t("Choose a Number", "选择一个数字")}</h2>
        <p className="mei-number-copy">{t("Keep your question in mind and enter the first number that comes to you. Don’t calculate or overthink it.", "心中保持这个问题，输入第一个自然浮现的数字。不要计算，也不要反复推敲。")}</p>
        <div className="mei-number-decoration">
          <label className="sr-only" htmlFor="mei-hua-number">{t("Your Number", "你的数字")}</label>
          <input id="mei-hua-number" type="text" inputMode="numeric" autoComplete="off" value={numberDraft} onChange={(event) => setNumberDraft(event.target.value)} />
        </div>
        <button type="submit" className="mei-button"><span aria-hidden="true">☯</span>{t("Continue", "继续")}</button>
      </form> : null}
      {step === 3 && selectedNumber !== null ? <div className="mei-confirm">
        {zh ? <div className="mei-flow-title" role="heading" aria-level={2}>确认你的数字</div> : <h1>Confirm Your Number</h1>}
        <p className="mei-confirm-copy">{t("Once confirmed, this number and this moment will be locked for this reading.", "确认后，本次起卦的数字与此刻将被锁定。")}</p>
        <div className="mei-confirm-cards" aria-label={t("Your Number and This Moment", "你的数字与此刻")}>
          <section className="mei-number-ring"><h2>{t("Your Number", "你的数字")}</h2><p>{selectedNumber}</p></section>
          <section className="mei-moment"><h2>{t("This Moment", "此刻")}</h2><dl>
            <div><dt><CalendarDays aria-hidden="true" />{t("Current Date", "当前日期")}</dt><dd>{formatDate(now, timeZone)}</dd></div>
            <div><dt><Clock3 aria-hidden="true" />{t("Local Time", "当地时间")}</dt><dd>{formatTime(now, timeZone)}</dd></div>
            <div><dt><MapPin aria-hidden="true" />{t("Time Zone", "时区")}</dt><dd>{timeZone}</dd></div>
          </dl></section>
        </div>
        <div className="mei-confirm-actions"><button type="button" className="mei-button mei-button-outline" onClick={changeNumber}>{t("Change Number", "更换数字")}</button><button type="button" className="mei-button" onClick={confirmAndCast}><span aria-hidden="true">☯</span>{t("Confirm & Cast", "确认并起卦")}</button></div>
      </div> : null}
      {error ? <p role="alert" className="mei-error">{error}</p> : null}
    </section>
  );
}

function SceneBook({ zh }: { zh: boolean }) {
  const homeHref = zh ? "/zh" : "/";
  const homeLabel = zh ? "返回中文首页" : "Return to Quick I Ching";
  return <Link href={homeHref} className="mei-scene-book" aria-label={homeLabel} title={homeLabel}><img src="/mei-hua/navigation-book.webp" alt="Quick I Ching" width="1536" height="1024" /><span>{homeLabel}</span></Link>;
}
