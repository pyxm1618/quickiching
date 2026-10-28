"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { normalizePublicQuestion, PUBLIC_QUESTION_MAX_CODE_POINTS } from "@/domain/public-reading/question";
import { patchPublicReadingSession, readPublicReadingSessionState } from "@/lib/public-reading-session";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import type { UiDictionary } from "@/i18n/dictionaries/types";

export type QuestionContext = {
  question?: string;
  coreQuestionAtCast?: string;
  coreQuestionFrozenAtCast: boolean;
  setQuestion: (value: string | undefined) => void;
  freezeCoreQuestion: () => string | undefined | false;
  restartQuestion: (force?: boolean) => void;
};

type QuestionFirstProps = {
  storageKey: string;
  legacyStorageKeys?: readonly string[];
  dictionary?: UiDictionary;
  deepReadingEligible?: boolean;
  presentation?: "default" | "home-ritual";
  homeHeading?: string;
  homeDescription?: string;
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
  legacyStorageKeys = [],
  dictionary = EN_UI_DICTIONARY,
  deepReadingEligible = false,
  presentation = "default",
  homeHeading,
  homeDescription,
  initialSession,
  children,
}: QuestionFirstProps) {
  const homeRitual = presentation === "home-ritual";
  const zh = dictionary.locale === "zh-Hans";
  const [started, setStarted] = useState(() => initialSession?.started ?? false);
  const [experienceStage, setExperienceStage] = useState<"landing" | "question-confirm" | "ritual">(
    () => initialSession?.started ? "ritual" : initialSession?.question ? "question-confirm" : "landing",
  );
  const [question, setQuestionState] = useState<string | undefined>(() => initialSession?.question ?? undefined);
  const [coreQuestionAtCast, setCoreQuestionAtCast] = useState<string | undefined>(() => initialSession?.coreQuestionAtCast ?? undefined);
  const [coreQuestionFrozenAtCast, setCoreQuestionFrozenAtCast] = useState(() => initialSession?.coreQuestionFrozenAtCast ?? false);
  const [draft, setDraft] = useState(() => initialSession?.question ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    const restored = readPublicReadingSessionState(storageKey, legacyStorageKeys);
    setStarted(restored.started);
    setQuestionState(restored.question);
    setDraft(restored.question ?? "");
    setCoreQuestionAtCast(restored.coreQuestionAtCast);
    setCoreQuestionFrozenAtCast(restored.coreQuestionFrozenAtCast);
    if (homeRitual) {
      setExperienceStage(restored.started ? "ritual" : restored.question ? "question-confirm" : "landing");
    }
  }, [homeRitual, legacyStorageKeys, storageKey]);

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
    }, legacyStorageKeys);
  }

  function setQuestion(value: string | undefined) {
    if (coreQuestionFrozenAtCast) return;
    try {
      const normalized = normalizePublicQuestion(value);
      if (!persist(true, normalized)) {
        setError(dictionary.questionFirst.saveError);
        return;
      }
      setQuestionState(normalized);
      setDraft(normalized ?? "");
      setError("");
    } catch (nextError: unknown) {
      setError(nextError instanceof Error && nextError.message === "PUBLIC_QUESTION_TOO_LONG"
        ? dictionary.questionFirst.tooLong.replace("{max}", String(PUBLIC_QUESTION_MAX_CODE_POINTS))
        : dictionary.questionFirst.saveError);
    }
  }

  function prepareQuestionConfirmation() {
    if (!homeRitual || coreQuestionFrozenAtCast) return;
    try {
      const normalized = normalizePublicQuestion(draft);
      if (!persist(false, normalized)) {
        setError(dictionary.questionFirst.saveError);
        return;
      }
      setQuestionState(normalized);
      setDraft(normalized ?? "");
      setError("");
      setExperienceStage("question-confirm");
    } catch (nextError: unknown) {
      setError(nextError instanceof Error && nextError.message === "PUBLIC_QUESTION_TOO_LONG"
        ? dictionary.questionFirst.tooLong.replace("{max}", String(PUBLIC_QUESTION_MAX_CODE_POINTS))
        : dictionary.questionFirst.useError);
    }
  }

  function continueToCasting() {
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
        if (homeRitual) setExperienceStage("ritual");
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
      if (homeRitual) setExperienceStage("ritual");
    } catch (nextError: unknown) {
      setError(nextError instanceof Error && nextError.message === "PUBLIC_QUESTION_TOO_LONG"
        ? dictionary.questionFirst.tooLong.replace("{max}", String(PUBLIC_QUESTION_MAX_CODE_POINTS))
        : dictionary.questionFirst.useError);
    }
  }

  function skip() {
    if (coreQuestionFrozenAtCast) return;
    const nextStarted = !homeRitual;
    if (!persist(nextStarted, undefined)) {
      setError(dictionary.questionFirst.saveError);
      return;
    }
    setQuestionState(undefined);
    setDraft("");
    setError("");
    setStarted(nextStarted);
    if (homeRitual) setExperienceStage("question-confirm");
  }

  function restartQuestion(force = false) {
    if (coreQuestionFrozenAtCast && !force) return;
    if (!persist(false, undefined, undefined, false)) {
      setError(dictionary.questionFirst.saveError);
      return;
    }
    setStarted(false);
    setQuestionState(undefined);
    setCoreQuestionAtCast(undefined);
    setCoreQuestionFrozenAtCast(false);
    setDraft("");
    setError("");
    if (homeRitual) setExperienceStage("landing");
  }

  function freezeCoreQuestion(): string | undefined | false {
    if (coreQuestionFrozenAtCast) return coreQuestionAtCast;
    const frozenQuestion = question;
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

  if (homeRitual) {
    const landing = experienceStage === "landing";
    const confirming = experienceStage === "question-confirm";
    return (
      <QuestionFirstContext.Provider value={context}>
        <section
          id="three-coin-reading"
          data-question-first
          data-three-coin-home-stage
          data-experience-stage={experienceStage}
          data-visual-status="internal-scaffold"
          className="mystic-shell min-h-[calc(100svh-5rem)] py-10 sm:py-14"
        >
          {experienceStage !== "ritual" ? (
            <div className="mx-auto grid min-h-[68svh] max-w-5xl content-center gap-7">
              {landing ? (
                <div>
                  <p className="mystic-kicker">{zh ? "Quick I Ching · 三枚铜钱" : "Quick I Ching · Three-Coin Method"}</p>
                  <h1 className="mt-4 max-w-4xl font-display text-4xl font-normal tracking-[-0.04em] sm:text-6xl">
                    {homeHeading ?? (zh ? "易经在线起卦" : "I Ching Online Reading")}
                  </h1>
                  <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--ink-2)] sm:text-base">
                    {homeDescription ?? (zh ? "写下此刻最想看清的问题，然后开始一次完整的六爻起卦。" : "Write the question you want to examine, then begin one complete six-line cast.")}
                  </p>
                </div>
              ) : (
                <div data-question-confirm>
                  <p className="mystic-kicker">{zh ? "确认本次问题" : "Confirm this reading"}</p>
                  <h1 className="mt-3 font-display text-3xl font-normal tracking-[-0.03em] sm:text-5xl">
                    {zh ? "确认你要问的问题" : "Confirm your question"}
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-2)]">
                    {zh ? "第一次真实起爻前仍可修改；第一爻生成时才会锁定。" : "You can still edit it before the first real cast. It is frozen only when line one is generated."}
                  </p>
                </div>
              )}

              <div className="mystic-card max-w-3xl p-5 sm:p-7">
                <label htmlFor={`${storageKey}-home-question`} className="block text-sm font-semibold text-[var(--ink)]">
                  {dictionary.questionFirst.label} <span className="font-normal text-[var(--ink-3)]">{dictionary.questionFirst.optional}</span>
                </label>
                <textarea
                  id={`${storageKey}-home-question`}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={3}
                  className="mt-2 min-h-28 w-full resize-y rounded-2xl border border-white/[0.12] bg-white/[0.035] px-4 py-3 text-sm leading-7 text-[var(--ink)] outline-none"
                  placeholder={dictionary.questionFirst.placeholder}
                  data-clarity-mask="true"
                  data-private-question="true"
                  disabled={coreQuestionFrozenAtCast}
                />
                {error ? <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="mystic-button"
                    onClick={landing ? prepareQuestionConfirmation : continueToCasting}
                    disabled={landing && deepReadingEligible && !draft.trim()}
                    data-home-primary-action
                  >
                    {landing
                      ? (zh ? "开始起卦" : "Start Reading")
                      : (zh ? "开始掷币" : "Start Casting")}
                  </button>
                  {landing && !coreQuestionFrozenAtCast ? (
                    <button type="button" onClick={skip} className="mystic-button-secondary" data-home-skip-question>
                      {dictionary.questionFirst.skipFreeOnly}
                    </button>
                  ) : null}
                  {confirming && !coreQuestionFrozenAtCast ? (
                    <button type="button" onClick={() => setExperienceStage("landing")} className="mystic-button-secondary">
                      {zh ? "返回" : "Back"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="min-h-40" data-home-coin-visual-placeholder aria-hidden="true" />
            </div>
          ) : (
            <>
              <div className="mb-4 flex justify-center" data-ritual-question-context>
                {question ? (
                  <input
                    value={draft}
                    onChange={(event) => setQuestion(event.target.value)}
                    className="w-full max-w-2xl border-0 bg-transparent px-3 py-2 text-center text-sm text-[var(--ink-3)] outline-none"
                    aria-label={zh ? "本次问题" : "Question for this reading"}
                    data-clarity-mask="true"
                    data-private-question="true"
                    disabled={coreQuestionFrozenAtCast}
                  />
                ) : (
                  <p className="text-center text-sm text-[var(--ink-3)]">
                    {zh ? "本次为无问题的免费起卦" : "This is a free cast without a bound question"}
                  </p>
                )}
              </div>
              {children}
            </>
          )}
        </section>
      </QuestionFirstContext.Provider>
    );
  }

  return (
    <QuestionFirstContext.Provider value={context}>
      <div data-question-first>
      {!started ? (
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
        </section>
      ) : (
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
      )}
        {started ? children : null}
      </div>
    </QuestionFirstContext.Provider>
  );
}
