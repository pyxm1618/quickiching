"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { normalizePublicQuestion, PUBLIC_QUESTION_MAX_CODE_POINTS } from "@/domain/public-reading/question";
import { patchPublicReadingSession, readPublicReadingSessionState } from "@/lib/public-reading-session";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import type { UiDictionary } from "@/i18n/dictionaries/types";

export type QuestionContext = {
  question?: string;
  setQuestion: (value: string | undefined) => void;
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
  const [started, setStarted] = useState(false);
  const [question, setQuestionState] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const restored = readPublicReadingSessionState(storageKey, legacyStorageKeys);
    setStarted(restored.started);
    setQuestionState(restored.question);
    setDraft(restored.question ?? "");
  }, [legacyStorageKeys, storageKey]);

  function persist(nextStarted: boolean, nextQuestion: string | undefined) {
    patchPublicReadingSession(storageKey, { started: nextStarted, ...(nextQuestion ? { question: nextQuestion } : {}) }, legacyStorageKeys);
  }

  function setQuestion(value: string | undefined) {
    try {
      const normalized = normalizePublicQuestion(value);
      setQuestionState(normalized);
      setDraft(normalized ?? "");
      setError("");
      persist(true, normalized);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error && nextError.message === "PUBLIC_QUESTION_TOO_LONG"
        ? dictionary.questionFirst.tooLong.replace("{max}", String(PUBLIC_QUESTION_MAX_CODE_POINTS))
        : dictionary.questionFirst.saveError);
    }
  }

  function continueToCasting() {
    try {
      const normalized = normalizePublicQuestion(draft);
      setQuestionState(normalized);
      setDraft(normalized ?? "");
      setError("");
      setStarted(true);
      persist(true, normalized);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error && nextError.message === "PUBLIC_QUESTION_TOO_LONG"
        ? dictionary.questionFirst.tooLong.replace("{max}", String(PUBLIC_QUESTION_MAX_CODE_POINTS))
        : dictionary.questionFirst.useError);
    }
  }

  function skip() {
    setQuestionState(undefined);
    setDraft("");
    setError("");
    setStarted(true);
    persist(true, undefined);
  }

  function restartQuestion() {
    setStarted(false);
    setQuestionState(undefined);
    setDraft("");
    setError("");
    persist(false, undefined);
  }

  const context: QuestionContext = { question, setQuestion, restartQuestion };

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
            aria-describedby={`${storageKey}-question-help ${storageKey}-question-error`}
          />
          <p id={`${storageKey}-question-help`} className="mt-2 text-xs leading-6 text-[var(--ink-3)]">{dictionary.questionFirst.help.replace("{max}", String(PUBLIC_QUESTION_MAX_CODE_POINTS))}</p>
          {error ? <p id={`${storageKey}-question-error`} role="alert" className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={continueToCasting} className="mystic-button">{dictionary.questionFirst.continueButton}</button>
            <button type="button" onClick={skip} className="mystic-button-secondary">{dictionary.questionFirst.skipButton}</button>
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
              />
              {error ? <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}
            </div>
            <button type="button" onClick={restartQuestion} className="mystic-button-secondary">{dictionary.questionFirst.newQuestion}</button>
          </div>
        </section>
      )}
        {started ? children : null}
      </div>
    </QuestionFirstContext.Provider>
  );
}
