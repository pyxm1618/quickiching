"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock3, MapPin } from "lucide-react";
import "./mei-hua-scene.css";
import { completedPublicReadingPath, writeCompletedPublicReading } from "@/lib/completed-public-reading";
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

const STORAGE_KEY = "quickiching:public-v1:mei-hua-number-time-v1";

type FlowStep = 1 | 2 | 3 | "reading";

type StoredNumberTimeCast = {
  mode: "number-time";
  inputVersion: typeof MEI_HUA_NUMBER_TIME_INPUT_VERSION;
  input: MeiHuaNumberTimeInput;
  result: MeiHuaNumberTimeResult;
};

function detectedTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return validIanaTimeZone(zone) ? zone : "UTC";
}

function parseNumberTimeCast(value: unknown): StoredNumberTimeCast | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { mode?: unknown; inputVersion?: unknown; input?: unknown };
  if (candidate.mode !== "number-time" || candidate.inputVersion !== MEI_HUA_NUMBER_TIME_INPUT_VERSION) return null;
  if (!candidate.input || typeof candidate.input !== "object") return null;
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
  const [cast, setCast] = useState<StoredNumberTimeCast | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const current = readPublicReadingSession(STORAGE_KEY, parseNumberTimeCast);
      if (!current) return;
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
    } catch {
      setError(zh ? "浏览器会话存储不可用，尚未创建正式卦象。" : "Browser session storage is unavailable. No cast has been created.");
    }
  }, [zh]);

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

  useEffect(() => {
    if (step !== "reading" || !publicReading) return;
    try {
      writeCompletedPublicReading(publicReading);
      setError("");
      router.push(completedPublicReadingPath(publicReading.id, zh));
    } catch {
      setError(zh
        ? "无法保存本次已完成起卦；同一个数字、时刻和卦象仍会保留，可以重试。"
        : "Unable to hand off this completed cast. The same number, moment, and cast are preserved for retry.");
    }
  }, [publicReading, router, step, zh]);

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
    } catch (nextError: unknown) {
      setError(nextError instanceof Error && nextError.message === "PUBLIC_QUESTION_TOO_LONG"
        ? t(`Keep the question within ${PUBLIC_QUESTION_MAX_CODE_POINTS} Unicode characters.`, `问题请控制在 ${PUBLIC_QUESTION_MAX_CODE_POINTS} 个 Unicode 字符以内。`)
        : t("This question could not be saved.", "无法保存这个问题。"));
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
      setError(t("Enter a whole number before continuing.", "请输入一个整数后继续。"));
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
      const result = meiHuaFromNumberAndTime(input);
      const nextCast: StoredNumberTimeCast = {
        mode: "number-time",
        inputVersion: MEI_HUA_NUMBER_TIME_INPUT_VERSION,
        input,
        result,
      };
      const session = writePublicReadingSession(STORAGE_KEY, nextCast);
      setSessionId(session.id);
      setQuestion(session.coreQuestionAtCast ?? session.question ?? question);
      setCast(nextCast);
      setError("");
      setStep("reading");
    } catch {
      setError(t("This cast could not be locked. No official cast was created.", "本次起卦无法锁定，尚未创建正式卦象。"));
    }
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
    setCast(null);
    setSessionId(null);
    setError("");
    setStep(1);
  }

  if (step === "reading" && cast && publicReading) {
    return (
      <section className="mei-scene mei-step-3" data-mei-hua-flow data-mei-hua-locked="true" aria-live="polite">
        <SceneBook zh={zh} />
        <div className="mei-confirm">
          {zh ? <div className="mei-flow-title" role="heading" aria-level={2}>起卦已完成</div> : <h1>Casting Complete</h1>}
          <p className="mei-confirm-copy">{error || (zh
            ? "正在进入统一解卦流程；同一个 cast 会继续用于登录、保存、免费解读和深度解读。"
            : "Opening the shared Reading flow. The same cast continues through sign-in, save, Free Reading, and Deep Reading.")}</p>
          {error ? <button type="button" className="mei-button" onClick={() => {
            try {
              writeCompletedPublicReading(publicReading);
              setError("");
              router.push(completedPublicReadingPath(publicReading.id, zh));
            } catch {
              setError(zh ? "仍无法保存本次已完成起卦；没有重新起卦，请稍后重试。" : "The completed cast still could not be handed off. No recast occurred; retry when browser session storage is available.");
            }
          }}>{zh ? "重试进入解卦" : "Retry Reading Handoff"}</button> : null}
        </div>
      </section>
    );
  }

  return (
    <section className={`mei-scene mei-step-${step}`} data-mei-hua-flow data-mei-hua-step={step} aria-label={t("Mei Hua Yi Shu", "梅花易数")}>
      <SceneBook zh={zh} />
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
