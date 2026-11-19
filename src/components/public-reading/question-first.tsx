"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { normalizePublicQuestion, PUBLIC_QUESTION_MAX_CODE_POINTS } from "@/domain/public-reading/question";
import { patchPublicReadingSession, readPublicReadingSessionState } from "@/lib/public-reading-session";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import type { UiDictionary } from "@/i18n/dictionaries/types";
import type { PublicReadingMethod } from "@/domain/public-reading/types";
import { retireMethodSession } from "@/lib/method-session-retirement";
import {
  NO_READING_RESUME,
  clearLiveFlowRegistration,
  detectMethodResume,
  registerLiveFlowFromSession,
  resumeProgressLabel,
  useLiveFlowUnmountCleanup,
  useLocaleContinuationActivation,
  type ReadingResumeState,
} from "@/lib/reading-resume";

export type QuestionContext = {
  question?: string;
  coreQuestionAtCast?: string;
  coreQuestionFrozenAtCast: boolean;
  setQuestion: (value: string | undefined) => void;
  freezeCoreQuestion: () => string | undefined | false;
  restartQuestion: (force?: boolean) => void;
};

/**
 * C1 — one explicit Resume for a QuestionFirst-wrapped method.
 *
 * The QuestionFirst boundary owns the Resume affordance and the exact question
 * restore; the method adapter (YarrowTool / ManualCastTool) subscribes to
 * `resumeRequested` and restores its own exact partial facts. A passive mount
 * never moves the UI stage.
 */
export type QuestionFirstResumeBoundary = {
  resumeRequested: boolean;
};

const QuestionFirstResumeContext = createContext<QuestionFirstResumeBoundary>({ resumeRequested: false });

export function useQuestionFirstResumeBoundary(): QuestionFirstResumeBoundary {
  return useContext(QuestionFirstResumeContext);
}

type QuestionFirstProps = {
  storageKey: string;
  dictionary?: UiDictionary;
  deepReadingEligible?: boolean;
  activeQuestionPresentation?: "default" | "hidden";
  /** Enables the shared passive-resume boundary for this method. */
  resumeMethod?: PublicReadingMethod;
  initialSession?: {
    started?: boolean;
    question?: string;
    coreQuestionAtCast?: string;
    coreQuestionFrozenAtCast?: boolean;
  };
  children: ReactNode;
};

const QuestionFirstContext = createContext<QuestionContext | null>(null);

export function useQuestionFirstContext(): QuestionContext | undefined {
  return useContext(QuestionFirstContext) ?? undefined;
}

export function QuestionFirst({
  storageKey,
  dictionary = EN_UI_DICTIONARY,
  deepReadingEligible = false,
  activeQuestionPresentation = "default",
  resumeMethod,
  initialSession,
  children,
}: QuestionFirstProps) {
  const zh = dictionary.locale === "zh-Hans";
  const [started, setStarted] = useState(() => initialSession?.started ?? false);
  const [question, setQuestionState] = useState<string | undefined>(() => initialSession?.question ?? undefined);
  const [coreQuestionAtCast, setCoreQuestionAtCast] = useState<string | undefined>(() => initialSession?.coreQuestionAtCast ?? undefined);
  const [coreQuestionFrozenAtCast, setCoreQuestionFrozenAtCast] = useState(() => initialSession?.coreQuestionFrozenAtCast ?? false);
  const [draft, setDraft] = useState(() => initialSession?.question ?? "");
  const [error, setError] = useState("");
  const [resumeState, setResumeState] = useState<ReadingResumeState>(NO_READING_RESUME);
  const [resumeRequested, setResumeRequested] = useState(false);

  // C1: detect persisted progress only. Nothing here may set the UI stage.
  useEffect(() => {
    if (!resumeMethod) return;
    const detected = detectMethodResume(resumeMethod);
    setResumeState(detected);
    // Exceptional sealed facts: mount the method adapter's recovery-only
    // surface (Retry Handoff / Start New Reading), never an active cast.
    if (detected.kind === "sealed") setStarted(true);
  }, [resumeMethod, storageKey]);

  useLocaleContinuationActivation({
    method: resumeMethod ?? null,
    locale: dictionary.locale,
    activate: () => requestResume(),
  });
  useLiveFlowUnmountCleanup(dictionary.locale);

  function requestResume() {
    // The continuation effect can run in the same commit as passive detection,
    // so authorize from a fresh R1 decision rather than a stale render snapshot.
    const detected = resumeMethod ? detectMethodResume(resumeMethod) : NO_READING_RESUME;
    if (detected.kind !== "partial") return;
    const restored = readPublicReadingSessionState(storageKey);
    setQuestionState(restored.question);
    setDraft(restored.question ?? "");
    setCoreQuestionAtCast(restored.coreQuestionAtCast);
    setCoreQuestionFrozenAtCast(restored.coreQuestionFrozenAtCast);
    setError("");
    setStarted(true);
    setResumeRequested(true);
    setResumeState(NO_READING_RESUME);
    if (resumeMethod) registerLiveFlowFromSession(resumeMethod, dictionary.locale);
  }

  /** Starting a brand-new reading is an explicit discard of an un-resumed partial. */
  function discardUnresumedPartial(): boolean {
    if (resumeState.kind !== "partial" || resumeRequested || !resumeMethod) return true;
    try {
      retireMethodSession(resumeMethod);
    } catch {
      setError(dictionary.questionFirst.saveError);
      return false;
    }
    setResumeState(NO_READING_RESUME);
    return true;
  }

  function persist(
    nextStarted: boolean,
    nextQuestion: string | undefined,
    frozenQuestion?: string,
    frozen = coreQuestionFrozenAtCast,
  ): boolean {
    return patchPublicReadingSession(storageKey, {
      started: nextStarted,
      ...(nextQuestion ? { question: nextQuestion } : {}),
      ...(frozen ? { coreQuestionAtCast: frozenQuestion ?? coreQuestionAtCast ?? "", coreQuestionFrozenAtCast: true } : {}),
    });
  }

  function setQuestion(value: string | undefined) {
    if (coreQuestionFrozenAtCast) return;
    const raw = value ?? "";
    try {
      if (Array.from(raw).length > PUBLIC_QUESTION_MAX_CODE_POINTS) {
        throw new Error("PUBLIC_QUESTION_TOO_LONG");
      }
      // Preserve the user's exact draft while they are typing. Canonical
      // normalization belongs at Continue / freeze / submit boundaries.
      if (!persist(true, raw || undefined)) {
        setError(dictionary.questionFirst.saveError);
        return;
      }
      setQuestionState(raw || undefined);
      setDraft(raw);
      setError("");
    } catch (nextError: unknown) {
      setError(nextError instanceof Error && nextError.message === "PUBLIC_QUESTION_TOO_LONG"
        ? dictionary.questionFirst.tooLong.replace("{max}", String(PUBLIC_QUESTION_MAX_CODE_POINTS))
        : dictionary.questionFirst.saveError);
    }
  }

  function continueToCasting() {
    if (!discardUnresumedPartial()) return;
    try {
      if (coreQuestionFrozenAtCast) {
        if (!persist(true, coreQuestionAtCast, coreQuestionAtCast ?? "", true)) {
          setError(dictionary.questionFirst.saveError);
          return;
        }
        setQuestionState(coreQuestionAtCast);
        setDraft(coreQuestionAtCast ?? "");
        setError("");
        setStarted(true);
        if (resumeMethod) registerLiveFlowFromSession(resumeMethod, dictionary.locale);
        return;
      }
      const normalized = normalizePublicQuestion(draft);
      if (!persist(true, normalized)) {
        setError(dictionary.questionFirst.saveError);
        return;
      }
      setQuestionState(normalized);
      setDraft(normalized ?? "");
      setError("");
      setStarted(true);
      if (resumeMethod) registerLiveFlowFromSession(resumeMethod, dictionary.locale);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error && nextError.message === "PUBLIC_QUESTION_TOO_LONG"
        ? dictionary.questionFirst.tooLong.replace("{max}", String(PUBLIC_QUESTION_MAX_CODE_POINTS))
        : dictionary.questionFirst.useError);
    }
  }

  function skip() {
    if (coreQuestionFrozenAtCast) return;
    if (!discardUnresumedPartial()) return;
    const nextStarted = true;
    if (!persist(nextStarted, undefined)) {
      setError(dictionary.questionFirst.saveError);
      return;
    }
    clearLiveFlowRegistration();
    setQuestionState(undefined);
    setDraft("");
    setError("");
    setStarted(nextStarted);
    if (resumeMethod) registerLiveFlowFromSession(resumeMethod, dictionary.locale);
  }

  function restartQuestion(force = false) {
    if (coreQuestionFrozenAtCast && !force) return;
    if (!persist(false, undefined, undefined, false)) {
      setError(dictionary.questionFirst.saveError);
      return;
    }
    if (resumeMethod) {
      try {
        retireMethodSession(resumeMethod);
      } catch {
        // The in-memory restart still returns to the default entry.
      }
    }
    clearLiveFlowRegistration();
    setStarted(false);
    setQuestionState(undefined);
    setCoreQuestionAtCast(undefined);
    setCoreQuestionFrozenAtCast(false);
    setDraft("");
    setError("");
    setResumeRequested(false);
    setResumeState(NO_READING_RESUME);
  }

  function freezeCoreQuestion(): string | undefined | false {
    if (coreQuestionFrozenAtCast) return coreQuestionAtCast;
    const frozenQuestion = normalizePublicQuestion(question);
    if (!persist(true, frozenQuestion, frozenQuestion ?? "", true)) {
      setError(dictionary.questionFirst.saveError);
      return false;
    }
    setCoreQuestionAtCast(frozenQuestion);
    setCoreQuestionFrozenAtCast(true);
    setQuestionState(frozenQuestion);
    setDraft(frozenQuestion ?? "");
    setError("");
    return frozenQuestion;
  }

  const context: QuestionContext = {
    question: coreQuestionFrozenAtCast ? coreQuestionAtCast : question,
    coreQuestionAtCast,
    coreQuestionFrozenAtCast,
    setQuestion,
    freezeCoreQuestion,
    restartQuestion,
  };

  return (
    <QuestionFirstContext.Provider value={context}>
      <QuestionFirstResumeContext.Provider value={{ resumeRequested }}>
      <div data-question-first>
      {!started && resumeState.kind !== "sealed" ? (
        <section className="mystic-card mb-8 p-5 sm:p-8" aria-labelledby={`${storageKey}-question-title`}>
          <p className="mystic-kicker">{deepReadingEligible ? dictionary.questionFirst.deepReadingKicker : dictionary.questionFirst.kicker}</p>
          <h2 id={`${storageKey}-question-title`} className="mt-2 font-display text-3xl font-normal tracking-[-.03em]">{dictionary.questionFirst.heading}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-2)]">{deepReadingEligible ? dictionary.questionFirst.deepReadingDescription : dictionary.questionFirst.description}</p>
          <label htmlFor={`${storageKey}-question`} className="mt-6 block text-sm font-semibold text-[var(--ink)]">{dictionary.questionFirst.label} <span className="font-normal text-[var(--ink-3)]">{dictionary.questionFirst.optional}</span></label>
          <textarea
            id={`${storageKey}-question`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            className="mt-2 min-h-28 w-full resize-y rounded-2xl border border-white/[0.12] bg-white/[0.035] px-4 py-3 text-sm leading-7 text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-3)] focus:border-[var(--gold)]"
            placeholder={dictionary.questionFirst.placeholder}
            data-clarity-mask="true"
            data-private-question="true"
            disabled={coreQuestionFrozenAtCast}
            aria-describedby={`${storageKey}-question-help ${storageKey}-question-error`}
          />
          <p id={`${storageKey}-question-help`} className="mt-2 text-xs leading-6 text-[var(--ink-3)]">{dictionary.questionFirst.help.replace("{max}", String(PUBLIC_QUESTION_MAX_CODE_POINTS))}</p>
          {error ? <p id={`${storageKey}-question-error`} role="alert" className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}
          {coreQuestionFrozenAtCast ? <p className="mt-2 text-xs leading-6 text-[var(--ink-3)]">{dictionary.locale === "zh-Hans" ? "这次起卦已包含落定的卦象，问题不能事后补写或更改。继续可查看免费解读；如需绑定问题，请重新起卦。" : "This cast already has sealed lines, so its question cannot be added or changed afterward. Continue to view the free reading, or start a new cast to bind a question."}</p> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={continueToCasting}
              className="mystic-button"
              disabled={deepReadingEligible && !draft.trim() && !coreQuestionFrozenAtCast}
            >
              {deepReadingEligible
                ? coreQuestionFrozenAtCast && !question
                  ? dictionary.questionFirst.continueFreeReading
                  : dictionary.questionFirst.continueWithQuestion
                : dictionary.questionFirst.continueButton}
            </button>
            {!coreQuestionFrozenAtCast ? (
              <button type="button" onClick={skip} className="mystic-button-secondary">
                {dictionary.questionFirst.skipFreeOnly}
              </button>
            ) : null}
          </div>
          {resumeState.kind === "partial" ? (
            <div className="mt-5 rounded-2xl border border-white/[0.12] bg-white/[0.035] p-4" data-reading-resume={resumeState.method}>
              <p className="text-sm leading-6 text-[var(--ink-2)]">
                {zh ? "你有一次尚未完成的起卦。" : "You have an unfinished cast."}
              </p>
              <button type="button" className="mystic-button-secondary mt-3" onClick={requestResume} data-reading-resume-action>
                {zh ? "继续上次起卦" : "Resume"} · {resumeProgressLabel(resumeState, zh)}
              </button>
            </div>
          ) : null}
        </section>
      ) : started && resumeState.kind !== "sealed" && activeQuestionPresentation === "default" ? (
        <section className="mystic-card mb-8 p-5 sm:p-6" aria-labelledby={`${storageKey}-active-question-title`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            {deepReadingEligible && !question ? (
              <div className="min-w-0 flex-1" id={`${storageKey}-active-question-title`}>
                <p className="mystic-kicker">{dictionary.questionFirst.activeKicker}</p>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">
                  {coreQuestionFrozenAtCast ? dictionary.questionFirst.freeOnlyAfterCast : dictionary.questionFirst.freeOnlyBeforeCast}
                </p>
                {!coreQuestionFrozenAtCast ? (
                  <button type="button" onClick={() => restartQuestion()} className="mystic-button-secondary mt-4" data-question-restart>
                    {dictionary.questionFirst.startOverWithQuestion}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <p className="mystic-kicker">{dictionary.questionFirst.activeKicker}</p>
                <label htmlFor={`${storageKey}-active-question`} id={`${storageKey}-active-question-title`} className="mt-2 block text-sm font-semibold text-[var(--ink)]">{dictionary.questionFirst.activeLabel} <span className="font-normal text-[var(--ink-3)]">{dictionary.questionFirst.optional}</span></label>
                <input
                  id={`${storageKey}-active-question`}
                  value={draft}
                  onChange={(event) => setQuestion(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-white/[0.12] bg-white/[0.035] px-4 py-2 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-3)] focus:border-[var(--gold)]"
                  placeholder={dictionary.questionFirst.activePlaceholder}
                  data-clarity-mask="true"
                  data-private-question="true"
                  disabled={coreQuestionFrozenAtCast}
                />
                {coreQuestionFrozenAtCast ? (
                  <p className="mt-2 text-xs leading-6 text-[var(--ink-3)]">{dictionary.locale === "zh-Hans" ? "核心问题已与本次起卦绑定。换问题请开始新起卦。" : "This core question is locked to this cast. Start a new reading to ask a different question."}</p>
                ) : null}
                {error ? <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}
              </div>
            )}
            {!deepReadingEligible && !coreQuestionFrozenAtCast ? (
              <button type="button" onClick={() => restartQuestion()} className="mystic-button-secondary">{dictionary.questionFirst.newQuestion}</button>
            ) : null}
          </div>
        </section>
      ) : null}
        {started ? children : null}
      </div>
      </QuestionFirstResumeContext.Provider>
    </QuestionFirstContext.Provider>
  );
}
