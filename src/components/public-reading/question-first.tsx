"use client";

import "./ritual.css";
import { ArrowRight } from "lucide-react";
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
  homeExperienceStage?: HomeExperienceStage;
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

export type HomeExperienceStage = "landing" | "question-confirm" | "ritual";

export function homeExperienceStageForSession(session?: {
  started?: boolean;
  question?: string;
  coreQuestionFrozenAtCast?: boolean;
}): HomeExperienceStage {
  if (session?.coreQuestionFrozenAtCast) return "ritual";
  if (session?.started || session?.question) return "question-confirm";
  return "landing";
}

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
  const [experienceStage, setExperienceStage] = useState<HomeExperienceStage>(
    () => homeExperienceStageForSession(initialSession),
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
      setExperienceStage(homeExperienceStageForSession(restored));
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
      if (!persist(true, normalized)) {
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
    const nextStarted = true;
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
    ...(homeRitual ? { homeExperienceStage: experienceStage } : {}),
  };

  if (homeRitual) {
    const landing = experienceStage === "landing";
    const confirming = experienceStage === "question-confirm";
    const homeTitleParts = homeHeading?.split(/\s*—\s*/u);
    const homeTitleFirst = homeTitleParts?.[0] ?? (zh ? "一卦一念" : "A Single Divination");
    const homeTitleSecond = homeTitleParts && homeTitleParts.length > 1
      ? ` — ${homeTitleParts.slice(1).join(" — ")}`
      : homeHeading ? undefined : (zh ? "看见更大的自己" : "See a Greater You");
    return (
      <QuestionFirstContext.Provider value={context}>
        <link rel="preload" as="image" href="/ritual/question-parchment-crop.png" media="(min-width:471px)" fetchPriority="high" />
        <link rel="preload" as="image" href="/ritual/question-parchment-mobile-crop.png" media="(max-width:470px)" fetchPriority="high" />
        <link rel="preload" as="image" href="/ritual/bg-stage-master-clean.lossless.webp" media="not all and (max-aspect-ratio:11/20)" fetchPriority="high" />
        <link rel="preload" as="image" href="/ritual/bg-stage-portrait-crop.webp" media="(min-width:601px) and (max-aspect-ratio:11/20)" fetchPriority="high" />
        <link rel="preload" as="image" href="/ritual/bg-stage-mobile-600.webp" media="(max-width:600px) and (max-aspect-ratio:11/20)" fetchPriority="low" />
        <section id="three-coin-reading" data-question-first data-three-coin-home-stage
          data-experience-stage={experienceStage} data-visual-status="in-development" className="ritual-canvas">
          <div className="ritual-room" aria-hidden="true" />
          {experienceStage !== "ritual" ? (
            <div className="ritual-question-stage">
              {landing ? <>
                <div className="ritual-home-heading">
                  <span className="ritual-cloud ritual-home-cloud-left" aria-hidden="true" />
                  <span className="ritual-cloud ritual-home-cloud-right" aria-hidden="true" />
                  <h1><em>{homeTitleFirst}</em>{homeTitleSecond ? <span className="ritual-title-second">{homeTitleSecond}</span> : null}</h1>
                  <p data-home-hero-copy>{zh ? (homeDescription ?? "在变化之中，重新认识此刻的自己。") : <>Use the I Ching online to rediscover where you are.<br />
                    It is not about predicting the future,<br />
                    but about seeing yourself more clearly in the present.</>}</p>
                </div>
              </> : <div className="ritual-confirm-heading" data-question-confirm>
                <span className="ritual-ink" aria-hidden="true" />
                <h1>{zh ? "此刻，你想问什么？" : <>What Would You Like<br />to Ask?</>}</h1>
                <span className="ritual-cloud" aria-hidden="true" />
                <p>{zh ? "静下心，写下此刻最想看清的问题。" : "Enter your question with a clear and focused mind."}<br />
                  {zh ? "让三枚铜钱带来易经的启示。" : "Let three coins reveal your guidance from the I Ching."}</p>
                <span className="ritual-divider" aria-hidden="true" />
              </div>}
              <div className="ritual-question-card">
                <label htmlFor={`${storageKey}-home-question`}>
                  {zh ? "此刻，你想问什么？" : "What would you like to ask?"}
                </label>
                <p className="ritual-question-description">{zh ? "描述一个你心中的具体问题。" : "Describe a specific question that is on your mind."}</p>
                <textarea id={`${storageKey}-home-question`} value={draft}
                  onChange={(event) => setDraft(event.target.value)} rows={3}
                  placeholder={landing ? (zh ? "例如：我应该继续现在的道路吗？" : "For example: Should I continue on my current path?") : (zh ? "在此输入你的问题…" : "Type your question here...")}
                  data-clarity-mask="true" data-private-question="true" disabled={coreQuestionFrozenAtCast} />
                <span className="ritual-character-count">{Array.from(draft).length}/{PUBLIC_QUESTION_MAX_CODE_POINTS}</span>
                {error ? <p role="alert" className="ritual-form-error">{error}</p> : null}
              </div>
              <div className="ritual-question-actions">
                <button type="button" className="ritual-gold-button" onClick={landing ? prepareQuestionConfirmation : continueToCasting}
                  disabled={landing && deepReadingEligible && !draft.trim()} data-home-primary-action>
                  <span className="ritual-taichi" aria-hidden="true" />
                  {landing ? (zh ? "开始起卦" : "Start Divination") : (zh ? "开始掷币" : "Cast the Coins")}
                  <ArrowRight size={26} strokeWidth={1.5} aria-hidden="true" />
                </button>
                {landing && !coreQuestionFrozenAtCast
                  ? <button type="button" onClick={skip} className="ritual-text-button ritual-home-skip" data-home-skip-question>{dictionary.questionFirst.skipFreeOnly}</button>
                  : <p className="ritual-cta-description">{landing
                    ? (zh ? "每个问题都值得看见。现在开始你的起卦。" : "No question is too small. Begin your divination now →")
                    : (zh ? "三枚铜钱将随机落定，为你带来一次易经起卦。" : <>Three coins will be cast at random,<br />bringing you an I Ching reading.</>)}</p>}
              </div>
              {confirming && !coreQuestionFrozenAtCast ? <button type="button" onClick={() => setExperienceStage("landing")} className="ritual-back">← {zh ? "返回" : "Back"}</button> : null}
            </div>
          ) : <>
            <div data-ritual-question-context className="ritual-question-context">
              {question ? <input value={draft} onChange={(event) => setQuestion(event.target.value)} aria-label={zh ? "本次问题" : "Question for this reading"}
                data-clarity-mask="true" data-private-question="true" disabled={coreQuestionFrozenAtCast} />
                : <p>{zh ? "本次为无问题的免费起卦" : "This is a free cast without a bound question"}</p>}
            </div>
          </>}
          {children}
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
