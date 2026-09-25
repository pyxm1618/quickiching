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
  restartQuestion: () => void;
};

type QuestionFirstProps = {
  storageKey: string;
  legacyStorageKeys?: readonly string[];
  dictionary?: UiDictionary;
  children: ReactNode;
};

const QuestionFirstContext = createContext<QuestionContext | null>(null);

export function useQuestionFirstContext(): QuestionContext | undefined {
  return useContext(QuestionFirstContext) ?? undefined;
}

export function QuestionFirst({ storageKey, legacyStorageKeys = [], dictionary = EN_UI_DICTIONARY, children }: QuestionFirstProps) {
  const [started, setStarted] = useState(() => {
    if (typeof window === "undefined") return false;
    return readPublicReadingSessionState(storageKey, legacyStorageKeys).started;
  });
  const [question, setQuestionState] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return readPublicReadingSessionState(storageKey, legacyStorageKeys).question;
  });
  const [coreQuestionAtCast, setCoreQuestionAtCast] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return readPublicReadingSessionState(storageKey, legacyStorageKeys).coreQuestionAtCast;
  });
  const [coreQuestionFrozenAtCast, setCoreQuestionFrozenAtCast] = useState(() => {
    if (typeof window === "undefined") return false;
    return readPublicReadingSessionState(storageKey, legacyStorageKeys).coreQuestionFrozenAtCast;
  });
  const [draft, setDraft] = useState(() => {
    if (typeof window === "undefined") return "";
    return readPublicReadingSessionState(storageKey, legacyStorageKeys).question ?? "";
  });
  const [error, setError] = useState("");

  useEffect(() => {
    const restored = readPublicReadingSessionState(storageKey, legacyStorageKeys);
    setStarted(restored.started);
    setQuestionState(restored.question);
    setDraft(restored.question ?? "");
    setCoreQuestionAtCast(restored.coreQuestionAtCast);
    setCoreQuestionFrozenAtCast(restored.coreQuestionFrozenAtCast);
  }, [legacyStorageKeys, storageKey]);

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
    } catch (nextError: unknown) {
      setError(nextError instanceof Error && nextError.message === "PUBLIC_QUESTION_TOO_LONG"
        ? dictionary.questionFirst.tooLong.replace("{max}", String(PUBLIC_QUESTION_MAX_CODE_POINTS))
        : dictionary.questionFirst.useError);
    }
  }

  function skip() {
    if (coreQuestionFrozenAtCast) return;
    if (!persist(true, undefined)) {
      setError(dictionary.questionFirst.saveError);
      return;
    }
    setQuestionState(undefined);
    setDraft("");
    setError("");
    setStarted(true);
  }

  function restartQuestion() {
    if (coreQuestionFrozenAtCast) return;
    if (!persist(false, undefined)) {
      setError(dictionary.questionFirst.saveError);
      return;
    }
    setStarted(false);
    setQuestionState(undefined);
    setCoreQuestionAtCast(undefined);
    setCoreQuestionFrozenAtCast(false);
    setDraft("");
    setError("");
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

  return (
    <QuestionFirstContext.Provider value={context}>
      <div data-question-first>
      {!started ? (
        <section className="mystic-card mb-8 p-5 sm:p-8" aria-labelledby={`${storageKey}-question-title`}>
          <p className="mystic-kicker">{dictionary.questionFirst.kicker}</p>
          <h2 id={`${storageKey}-question-title`} className="mt-2 font-display text-3xl font-normal tracking-[-.03em]">{dictionary.questionFirst.heading}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-2)]">{dictionary.questionFirst.description}</p>
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
            <button type="button" onClick={continueToCasting} className="mystic-button">{dictionary.questionFirst.continueButton}</button>
            {!coreQuestionFrozenAtCast ? <button type="button" onClick={skip} className="mystic-button-secondary">{dictionary.questionFirst.skipButton}</button> : null}
          </div>
        </section>
      ) : (
        <section className="mystic-card mb-8 p-5 sm:p-6" aria-labelledby={`${storageKey}-active-question-title`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
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
            {!coreQuestionFrozenAtCast ? (
              <button type="button" onClick={restartQuestion} className="mystic-button-secondary">{dictionary.questionFirst.newQuestion}</button>
            ) : null}
          </div>
        </section>
      )}
        {started ? children : null}
      </div>
    </QuestionFirstContext.Provider>
  );
}
