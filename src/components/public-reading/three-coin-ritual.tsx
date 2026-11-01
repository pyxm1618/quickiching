"use client";

import "./ritual.css";
import { ArrowRight } from "lucide-react";
import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { normalizePublicQuestion, PUBLIC_QUESTION_MAX_CODE_POINTS } from "@/domain/public-reading/question";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import type { UiDictionary } from "@/i18n/dictionaries/types";
import {
  patchThreeCoinQuestionSession,
  readThreeCoinQuestionState,
  THREE_COIN_SESSION_STORAGE_KEY,
} from "@/lib/three-coin-session";

export type ThreeCoinExperienceStage = "landing" | "question-confirm" | "ritual";

export function threeCoinExperienceStageForSession(session?: {
  started?: boolean;
  question?: string;
  coreQuestionFrozenAtCast?: boolean;
}): ThreeCoinExperienceStage {
  if (session?.coreQuestionFrozenAtCast) return "ritual";
  if (session?.started || session?.question) return "question-confirm";
  return "landing";
}

export type ThreeCoinRitualContextValue = {
  question?: string;
  coreQuestionAtCast?: string;
  coreQuestionFrozenAtCast: boolean;
  setQuestion: (value: string | undefined) => void;
  freezeCoreQuestion: () => string | undefined | false;
  restartQuestion: (force?: boolean) => void;
  experienceStage: ThreeCoinExperienceStage;
};

const ThreeCoinRitualContext = createContext<ThreeCoinRitualContextValue | null>(null);

export function useThreeCoinRitualContext(): ThreeCoinRitualContextValue {
  const context = useContext(ThreeCoinRitualContext);
  if (!context) throw new Error("THREE_COIN_RITUAL_CONTEXT_REQUIRED");
  return context;
}

export function ThreeCoinRitual({
  dictionary = EN_UI_DICTIONARY,
  homeHeading,
  homeDescription,
  headingLevel = 1,
  initialSession,
  children,
}: {
  dictionary?: UiDictionary;
  homeHeading?: string;
  homeDescription?: string;
  headingLevel?: 1 | 2;
  initialSession?: {
    started?: boolean;
    question?: string;
    coreQuestionAtCast?: string;
    coreQuestionFrozenAtCast?: boolean;
  };
  children: ReactNode;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const zh = dictionary.locale === "zh-Hans";
  const [experienceStage, setExperienceStage] = useState<ThreeCoinExperienceStage>(
    () => threeCoinExperienceStageForSession(initialSession),
  );
  const [presentationStage, setPresentationStage] = useState<ThreeCoinExperienceStage>(
    () => threeCoinExperienceStageForSession(initialSession),
  );
  const [confirmationEntered, setConfirmationEntered] = useState(false);
  const [question, setQuestionState] = useState<string | undefined>(() => initialSession?.question ?? undefined);
  const [coreQuestionAtCast, setCoreQuestionAtCast] = useState<string | undefined>(() => initialSession?.coreQuestionAtCast ?? undefined);
  const [coreQuestionFrozenAtCast, setCoreQuestionFrozenAtCast] = useState(() => initialSession?.coreQuestionFrozenAtCast ?? false);
  const [draft, setDraft] = useState(() => initialSession?.question ?? "");
  const [error, setError] = useState("");
  const roomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const room = roomRef.current;
    const frame = window.requestAnimationFrame(() => {
      if (room) room.dataset.roomReady = "true";
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (experienceStage !== "question-confirm") {
      setConfirmationEntered(false);
      return;
    }
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 200 : 500;
    const timer = setTimeout(() => setConfirmationEntered(true), duration);
    return () => clearTimeout(timer);
  }, [experienceStage]);

  useEffect(() => {
    if (presentationStage === experienceStage) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 140 : presentationStage === "landing" ? 260 : presentationStage === "question-confirm" ? 240 : 0;
    const timer = setTimeout(() => setPresentationStage(experienceStage), delay);
    return () => clearTimeout(timer);
  }, [presentationStage, experienceStage]);

  useEffect(() => {
    const restored = readThreeCoinQuestionState();
    setQuestionState(restored.question);
    setDraft(restored.question ?? "");
    setCoreQuestionAtCast(restored.coreQuestionAtCast);
    setCoreQuestionFrozenAtCast(restored.coreQuestionFrozenAtCast);
    const stage = threeCoinExperienceStageForSession(restored);
    setExperienceStage(stage);
    setPresentationStage(stage);
  }, []);

  function persist(
    nextStarted: boolean,
    nextQuestion: string | undefined,
    frozenQuestion?: string,
    frozen = coreQuestionFrozenAtCast,
  ): boolean {
    return patchThreeCoinQuestionSession({
      started: nextStarted,
      ...(nextQuestion ? { question: nextQuestion } : {}),
      ...(frozen ? {
        coreQuestionAtCast: frozenQuestion ?? coreQuestionAtCast ?? "",
        coreQuestionFrozenAtCast: true,
      } : {}),
    });
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
    if (coreQuestionFrozenAtCast) return;
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
        setExperienceStage("ritual");
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
      setExperienceStage("ritual");
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
    setExperienceStage("question-confirm");
  }

  function restartQuestion(force = false) {
    if (coreQuestionFrozenAtCast && !force) return;
    if (!persist(false, undefined, undefined, false)) {
      setError(dictionary.questionFirst.saveError);
      return;
    }
    setQuestionState(undefined);
    setCoreQuestionAtCast(undefined);
    setCoreQuestionFrozenAtCast(false);
    setDraft("");
    setError("");
    setExperienceStage("landing");
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

  const context: ThreeCoinRitualContextValue = {
    question: coreQuestionFrozenAtCast ? coreQuestionAtCast : question,
    coreQuestionAtCast,
    coreQuestionFrozenAtCast,
    setQuestion,
    freezeCoreQuestion,
    restartQuestion,
    experienceStage,
  };

  const landing = experienceStage === "landing";
  const confirming = experienceStage === "question-confirm";
  const homeLeaving = presentationStage === "landing" && confirming;
  const questionLeaving = presentationStage === "question-confirm" && experienceStage === "ritual";
  const homeTitleParts = homeHeading?.split(/\s*—\s*/u);
  const homeTitleFirst = homeTitleParts?.[0] ?? (zh ? "一卦一念" : "A Single Divination");
  const homeTitleSecond = homeTitleParts && homeTitleParts.length > 1
    ? ` — ${homeTitleParts.slice(1).join(" — ")}`
    : homeHeading ? undefined : (zh ? "看见更大的自己" : "See a Greater You");

  return (
    <ThreeCoinRitualContext.Provider value={context}>
      <link rel="preload" as="image" href="/performance/questionDesktop.d616c1d6e5957a79.png" media="(min-width:471px)" fetchPriority="high" />
      <link rel="preload" as="image" href="/performance/questionMobile.aeacbe5208415e49.webp" media="(max-width:470px)" fetchPriority="high" />
      <link rel="preload" as="image" href="/performance/stagePortrait.bde3e415eb141bc8.webp" media="(min-width:601px) and (max-aspect-ratio:11/20)" fetchPriority="high" />
      <link rel="preload" as="image" href="/performance/stageMobile.285965e6cb8c7840.webp" media="(max-width:600px) and (max-aspect-ratio:11/20)" fetchPriority="low" />
      <link rel="preload" as="image" href="/ritual/decor/gold-cloud-button-2x.png" media="(max-width:800px)" fetchPriority="low" />
      <link rel="preload" as="image" href="/ritual/decor/yin-yang.png" media="(max-width:800px)" fetchPriority="low" />
      <section id="three-coin-reading" data-three-coin-ritual data-experience-stage={experienceStage} data-question-leaving={questionLeaving} className="ritual-canvas">
        <div ref={roomRef} className="ritual-room" aria-hidden="true" />
        {experienceStage !== "ritual" || questionLeaving ? (
          <div className="ritual-question-stage" data-leaving={questionLeaving} inert={questionLeaving}>
            {landing || homeLeaving ? (
              <div className="ritual-home-heading" data-leaving={homeLeaving}>
                <span className="ritual-cloud ritual-home-cloud-left" aria-hidden="true" />
                <span className="ritual-cloud ritual-home-cloud-right" aria-hidden="true" />
                <Heading><em>{homeTitleFirst}</em>{homeTitleSecond ? <span className="ritual-title-second">{homeTitleSecond}</span> : null}</Heading>
                <p data-home-hero-copy>{zh ? (homeDescription ?? "在变化之中，重新认识此刻的自己。") : <>Use the I Ching online to rediscover where you are.<br />It is not about predicting the future,<br />but about seeing yourself more clearly in the present.</>}</p>
              </div>
            ) : null}
            {!landing ? (
              <div className="ritual-confirm-heading" data-question-confirm>
                <span className="ritual-ink" aria-hidden="true" />
                <Heading>{zh ? "此刻，你想问什么？" : <>What Would You Like<br />to Ask?</>}</Heading>
                <span className="ritual-cloud" aria-hidden="true" />
                <p>{zh ? "静下心，写下此刻最想看清的问题。" : "Enter your question with a clear and focused mind."}<br />
                  {zh ? "让三枚铜钱带来易经的启示。" : "Let three coins reveal your guidance from the I Ching."}</p>
                <span className="ritual-divider" aria-hidden="true" />
              </div>
            ) : null}
            <div className="ritual-question-card">
              <img
                className="ritual-question-card-art"
                src="/performance/questionDesktop.d616c1d6e5957a79.png"
                alt=""
                width={646}
                height={184}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                aria-hidden="true"
              />
              <label htmlFor={`${THREE_COIN_SESSION_STORAGE_KEY}-question`}>{zh ? "此刻，你想问什么？" : "What would you like to ask?"}</label>
              <p className="ritual-question-description">{zh ? "描述一个你心中的具体问题。" : "Describe a specific question that is on your mind."}</p>
              <textarea id={`${THREE_COIN_SESSION_STORAGE_KEY}-question`} value={draft} onChange={(event) => setDraft(event.target.value)} rows={3}
                placeholder={landing ? (zh ? "例如：我应该继续现在的道路吗？" : "For example: Should I continue on my current path?") : (zh ? "在此输入你的问题…" : "Type your question here...")}
                data-clarity-mask="true" data-private-question="true" disabled={coreQuestionFrozenAtCast} />
              <span className="ritual-character-count">{Array.from(draft).length}/{PUBLIC_QUESTION_MAX_CODE_POINTS}</span>
              {error ? <p role="alert" className="ritual-form-error">{error}</p> : null}
            </div>
            <div className="ritual-question-actions" data-entered={confirmationEntered} onAnimationEnd={(event) => { if (event.target === event.currentTarget && confirming) setConfirmationEntered(true); }}>
              <button type="button" className="ritual-gold-button" onClick={landing ? prepareQuestionConfirmation : continueToCasting}
                disabled={(landing && !draft.trim()) || (confirming && !confirmationEntered)} data-home-primary-action>
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
        ) : (
          <div data-ritual-question-context className="ritual-question-context">
            {question
              ? <input value={draft} onChange={(event) => setQuestion(event.target.value)} aria-label={zh ? "本次问题" : "Question for this reading"}
                  data-clarity-mask="true" data-private-question="true" disabled={coreQuestionFrozenAtCast} />
              : <p>{zh ? "本次为无问题的免费起卦" : "This is a free cast without a bound question"}</p>}
          </div>
        )}
        {children}
      </section>
    </ThreeCoinRitualContext.Provider>
  );
}
