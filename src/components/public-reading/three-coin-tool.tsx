"use client";

import React, { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { buildPublicReading } from "@/domain/public-reading/reading";
import type { PublicReading } from "@/domain/public-reading/types";
import { clearCompletedReadingForRestart } from "@/lib/completed-public-reading";
import { completeReadingHandoff, readingHandoffFailureCopy } from "@/lib/reading-handoff";
import { ThreeCoinVisual } from "./three-coin-visual";
import { RitualCastPresentation } from "./ritual-cast-presentation";
import { CAST_ACTION_MS, COIN_RESET_MS } from "./three-coin-motion";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import type { UiDictionary } from "@/i18n/dictionaries/types";
import { useThreeCoinRitualContext } from "@/components/public-reading/three-coin-ritual";
import { generateThreeCoinLine, type CoinFace, type ThreeCoinStep } from "@/domain/casting/three-coin/algorithm";
import { browserRandomBit } from "@/lib/browser-random";
import {
  clearThreeCoinReading,
  completedThreeCoinSteps,
  readThreeCoinSession,
  writeThreeCoinSteps,
  type ThreeCoinReadingSession,
} from "@/lib/three-coin-session";

type MotionState = "idle" | "holding" | "casting" | "settled";
type UnpersistedCommit = { steps: ThreeCoinStep[]; step: ThreeCoinStep };

export function canRecordSettledThreeCoin(input: {
  motion: MotionState;
  storageBlocked: boolean;
  stepCount: number;
  revealedCount: number;
}): boolean {
  return input.motion === "settled"
    && !input.storageBlocked
    && input.stepCount > input.revealedCount;
}

/**
 * C1 / C2 — a restored completed session must never navigate. Only a cast that
 * reached completion through this mounted flow may hand off, exactly once.
 */
export function shouldHandoffFreshThreeCoinCompletion(input: {
  freshCompletion: boolean;
  complete: boolean;
  visuallyComplete: boolean;
  hasReadingMeta: boolean;
  storageBlocked: boolean;
  hasUnpersistedCommit: boolean;
  handoffStarted: boolean;
  sealedRecovery: boolean;
}): boolean {
  return input.freshCompletion
    && input.complete
    && input.visuallyComplete
    && input.hasReadingMeta
    && !input.storageBlocked
    && !input.hasUnpersistedCommit
    && !input.handoffStarted
    && !input.sealedRecovery;
}

function storageErrorCode(error: unknown): string {
  return error instanceof Error ? error.message : "THREE_COIN_SESSION_UNAVAILABLE";
}

function readingFromSealedSession(session: ThreeCoinReadingSession | null): PublicReading | null {
  const complete = completedThreeCoinSteps(session?.data?.steps ?? []);
  if (!session || !complete) return null;
  try {
    return buildPublicReading({
      id: session.id,
      createdAt: session.createdAt,
      method: "three-coin",
      question: session.coreQuestionAtCast ?? session.question,
      lineValuesBottomUp: complete.map((entry) => entry.lineValue),
      evidence: { kind: "three-coin", steps: complete },
    });
  } catch {
    return null;
  }
}

export function ThreeCoinTool({ dictionary = EN_UI_DICTIONARY }: { dictionary?: UiDictionary }) {
  const router = useRouter();
  const questionContext = useThreeCoinRitualContext();
  const homeStage = questionContext.experienceStage;
  const showRitualControls = homeStage === "ritual";
  const zh = dictionary.locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  const [steps, setSteps] = useState<ThreeCoinStep[]>([]);
  const [readingMeta, setReadingMeta] = useState<{ id: string; createdAt: string } | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [restored, setRestored] = useState(false);
  const [motion, setMotion] = useState<MotionState>("idle");
  const [pendingStep, setPendingStep] = useState<ThreeCoinStep | null>(null);
  const [unpersistedCommit, setUnpersistedCommit] = useState<UnpersistedCommit | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [visualResetting,setVisualResetting]=useState(false);
  const [sceneReady,setSceneReady]=useState(false);
  const [freshCompletion, setFreshCompletion] = useState(false);
  const [sealedReading, setSealedReading] = useState<PublicReading | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const visualReady = sceneReady;
  const resetTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const holdingRef = useRef(false);
  const ignoreSyntheticClickRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const shakeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handoffStartedRef = useRef(false);

  useEffect(() => {
    try {
      const resume = questionContext.resumeState;
      if (resume.kind === "sealed") {
        // Completed-but-not-durable facts: recovery only, never an active cast.
        setSealedReading(readingFromSealedSession(readThreeCoinSession()));
      } else if (resume.kind === "partial" && questionContext.resumeRequested) {
        const session = readThreeCoinSession();
        const stored = session?.data?.steps ?? [];
        setSteps(stored);
        setReadingMeta(session ? { id: session.id, createdAt: session.createdAt } : null);
        setRevealedCount(stored.length);
      }
      setStorageError(null);
    } catch (error: unknown) {
      setStorageError(storageErrorCode(error));
    } finally {
      setRestored(true);
    }
  }, [questionContext.resumeRequested, questionContext.resumeState]);

  useEffect(() => () => {
    if (shakeIntervalRef.current) clearInterval(shakeIntervalRef.current);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    void audioRef.current?.close();
  }, []);

  useEffect(() => {
    if (homeStage === "landing") setSceneReady(false);
  }, [homeStage]);

  const lines = useMemo(() => steps.map((step) => step.lineValue), [steps]);
  const revealedSteps = useMemo(() => steps.slice(0, revealedCount), [steps, revealedCount]);
  const complete = lines.length === 6;
  const completedReading = useMemo(() => complete && readingMeta
    ? buildPublicReading({
        id: readingMeta.id,
        createdAt: readingMeta.createdAt,
        method: "three-coin",
        question: questionContext.coreQuestionAtCast ?? questionContext.question,
        lineValuesBottomUp: lines,
        evidence: { kind: "three-coin", steps },
      })
    : null, [complete, lines, questionContext.coreQuestionAtCast, questionContext.question, readingMeta, steps]);
  const visuallyComplete = revealedCount === 6;
  const settledUnrecordedStep = motion === "settled" && steps.length > revealedCount
    ? steps[revealedCount] ?? null
    : null;
  const visibleStep = unpersistedCommit?.step ?? pendingStep ?? settledUnrecordedStep ?? revealedSteps.at(-1) ?? null;
  const visibleFaces: readonly [CoinFace, CoinFace, CoinFace] = visibleStep?.coinFaces ?? ["yang", "yang", "yang"];
  const storageBlocked = storageError !== null;
  const busy = !visualReady || visualResetting || motion === "holding" || motion === "casting" || storageBlocked || !restored;
  const visualButtonLabel = storageBlocked
    ? t("Browser storage unavailable", "浏览器存储不可用")
    : !visualReady && !complete
      ? t("Preparing the ritual…", "正在准备仪式…")
    : motion === "casting"
      ? t("Coins are settling…", "铜钱正在落定…")
      : complete
        ? t("Reading complete", "起卦完成")
        : t("Press & hold to shake · release to cast", "按住摇动 · 松开起爻");
  useEffect(() => {
    if (!shouldHandoffFreshThreeCoinCompletion({
      freshCompletion,
      complete,
      visuallyComplete,
      hasReadingMeta: Boolean(readingMeta),
      storageBlocked,
      hasUnpersistedCommit: Boolean(unpersistedCommit),
      handoffStarted: handoffStartedRef.current,
      sealedRecovery: Boolean(sealedReading),
    })) return;
    if (!completedReading) return;

    handoffStartedRef.current = true;
    const outcome = completeReadingHandoff({ reading: completedReading, zh, router });
    if (outcome.kind === "failed") {
      // Sealed recovery: same readingId, same cast facts, no recast, no navigation.
      setSealedReading(completedReading);
      setHandoffError(readingHandoffFailureCopy(outcome, zh));
      handoffStartedRef.current = false;
      return;
    }
    setHandoffError(null);
  }, [complete, completedReading, freshCompletion, readingMeta, router, sealedReading, storageBlocked, unpersistedCommit, visuallyComplete, zh]);

  function audio(): AudioContext | null {
    if (!soundOn || typeof window === "undefined") return null;
    try {
      if (!audioRef.current) {
        const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtor) return null;
        audioRef.current = new AudioCtor();
      }
      if (audioRef.current.state === "suspended") void audioRef.current.resume();
      return audioRef.current;
    } catch {
      return null;
    }
  }

  function tone(pitch = 900, duration = 0.07, gain = 0.035, delay = 0, type: OscillatorType = "triangle") {
    try {
      const context = audio();
      if (!context) return;
      const start = context.currentTime + delay;
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(pitch, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, pitch * 0.55), start + duration);
      volume.gain.setValueAtTime(gain, start);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(volume).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    } catch {
      // Sound is optional UI feedback and must never block the cast.
    }
  }

  function shakeTick() {
    tone(1120, 0.035, 0.011);
    tone(1510, 0.025, 0.005, 0.018, "sine");
  }

  function stopShake() {
    holdingRef.current = false;
    if (shakeIntervalRef.current) {
      clearInterval(shakeIntervalRef.current);
      shakeIntervalRef.current = null;
    }
  }

  function beginHold() {
    if (!visualReady || !restored || storageBlocked || complete || visualResetting || motion === "casting" || holdingRef.current) return;
    if (steps.length > revealedCount) return;
    holdingRef.current = true;
    setPendingStep(null);
    setMotion("holding");
    shakeTick();
    shakeIntervalRef.current = setInterval(shakeTick, 155);
  }

  function cancelHold() {
    if (!holdingRef.current) return;
    stopShake();
    setPendingStep(null);
    setMotion("idle");
  }

  function beginVisualSettlement(committedSteps: ThreeCoinStep[], next: ThreeCoinStep) {
    setSteps(committedSteps);
    setUnpersistedCommit(null);
    setStorageError(null);
    setPendingStep(next);
    setMotion("casting");

    tone(520, 0.19, 0.075, 0.63);
    tone(610, 0.16, 0.064, 0.685);
    tone(465, 0.22, 0.07, 0.755);
    tone(1180, 0.14, 0.024, 0.86);
    tone(930, 0.18, 0.02, 0.96);
    tone(1010, 0.17, 0.018, 1.08);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    settleTimerRef.current = setTimeout(() => {
      setPendingStep(null);
      setMotion("settled");
      tone(360, 0.34, 0.023, 0, "sine");
      tone(720, 0.42, 0.01, 0.03, "sine");
      settleTimerRef.current = null;
    }, reducedMotion ? 320 : CAST_ACTION_MS);
  }

  function persistCast(committedSteps: ThreeCoinStep[], next: ThreeCoinStep) {
    try {
      const session = writeThreeCoinSteps(committedSteps);
      setReadingMeta({ id: session.id, createdAt: session.createdAt });
      if (committedSteps.length === 6) setFreshCompletion(true);
      beginVisualSettlement(committedSteps, next);
    } catch (error: unknown) {
      setPendingStep(null);
      setMotion("idle");
      setUnpersistedCommit({ steps: committedSteps, step: next });
      setStorageError(storageErrorCode(error));
    }
  }

  function releaseCast() {
    if (!holdingRef.current || complete || storageBlocked) return;
    stopShake();

    if (steps.length === 0 && questionContext.freezeCoreQuestion() === false) return;
    const lineIndex = steps.length as 0 | 1 | 2 | 3 | 4 | 5;
    const next = generateThreeCoinLine(lineIndex, browserRandomBit);
    const committedSteps = [...steps, next];

    // The cast becomes authoritative at release. It is not shown as sealed until the same
    // result is durably written to this browser session; a failed write is retried, not rerolled.
    persistCast(committedSteps, next);
  }

  function recordSettledLine() {
    if (!canRecordSettledThreeCoin({
      motion,
      storageBlocked,
      stepCount: steps.length,
      revealedCount,
    })) return;
    const nextRevealedCount = revealedCount + 1;
    setRevealedCount(nextRevealedCount);
    if (nextRevealedCount < 6) {
      setMotion("idle");setVisualResetting(true);
      resetTimerRef.current=setTimeout(()=>{setVisualResetting(false);resetTimerRef.current=null;},window.matchMedia("(prefers-reduced-motion: reduce)").matches?140:COIN_RESET_MS);
    }
  }

  function retryStorage() {
    if (unpersistedCommit) {
      persistCast(unpersistedCommit.steps, unpersistedCommit.step);
      return;
    }

    try {
      const session = readThreeCoinSession();
      const stored = session?.data?.steps ?? [];
      setSteps(stored);
      setReadingMeta(session ? { id: session.id, createdAt: session.createdAt } : null);
      setRevealedCount(stored.length);
      setStorageError(null);
    } catch (error: unknown) {
      setStorageError(storageErrorCode(error));
    }
  }

  function reset() {
    try {
      clearThreeCoinReading();
    } catch (error: unknown) {
      setStorageError(storageErrorCode(error));
      return;
    }

    if(resetTimerRef.current)clearTimeout(resetTimerRef.current);
    resetTimerRef.current=null;setVisualResetting(false);
    setSceneReady(false);
    holdingRef.current = false;
    ignoreSyntheticClickRef.current = false;
    if (shakeIntervalRef.current) clearInterval(shakeIntervalRef.current);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    shakeIntervalRef.current = null;
    settleTimerRef.current = null;
    setPendingStep(null);
    setUnpersistedCommit(null);
    setStorageError(null);
    setMotion("idle");
    setRevealedCount(0);
    setReadingMeta(null);
    setSteps([]);
    setFreshCompletion(false);
    setSealedReading(null);
    setHandoffError(null);
    handoffStartedRef.current = false;
  }

  function startNewReading() {
    reset();
    questionContext.restartQuestion(true);
  }

  function retrySealedHandoff() {
    if (!sealedReading) return;
    const outcome = completeReadingHandoff({ reading: sealedReading, zh, router });
    if (outcome.kind === "failed") {
      setHandoffError(readingHandoffFailureCopy(outcome, zh));
      return;
    }
    setHandoffError(null);
    setSealedReading(null);
  }

  function discardSealedReading() {
    try {
      clearCompletedReadingForRestart("three-coin", zh, sealedReading?.id);
    } catch (error: unknown) {
      setHandoffError(storageErrorCode(error));
      return;
    }
    setSealedReading(null);
    setHandoffError(null);
    reset();
    questionContext.restartQuestion(true);
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    ignoreSyntheticClickRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    beginHold();
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    releaseCast();
  }

  function onPointerCancel(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    ignoreSyntheticClickRef.current = true;
    cancelHold();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
      event.preventDefault();
      ignoreSyntheticClickRef.current = true;
      beginHold();
    }
  }

  function onKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      releaseCast();
      ignoreSyntheticClickRef.current = false;
    }
  }

  function onAccessibleClick(_event: MouseEvent<HTMLButtonElement>) {
    if (ignoreSyntheticClickRef.current) {
      ignoreSyntheticClickRef.current = false;
      return;
    }
    if (!visualReady || !restored || storageBlocked || visualResetting || holdingRef.current || complete || motion === "casting") return;
    if (steps.length > revealedCount) return;
    beginHold();
    releaseCast();
  }

  return (
    <section data-realm="chamber" data-three-coin-presentation="ritual" data-home-stage={homeStage} aria-labelledby={showRitualControls ? "three-coin-tool-title" : undefined}>
      {sealedReading ? (
        <div
          className="relative z-[3] mx-auto mb-6 max-w-2xl rounded-[1.2rem] border border-[rgba(239,129,112,0.36)] bg-[rgba(239,129,112,0.08)] px-5 py-4"
          role="alert"
          data-reading-sealed-recovery={sealedReading.id}
        >
          <p className="text-sm font-semibold text-[var(--danger)]">
            {t("This completed cast still has to reach Reading Choice.", "这次已完成的起卦还没有进入解卦选择。")}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
            {handoffError ?? t("Nothing was recast. Retrying reuses the exact same reading.", "没有重新起卦。重试会沿用完全相同的这一次起卦。")}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className="sound-toggle" onClick={retrySealedHandoff} data-reading-retry-handoff>
              {t("Retry Handoff", "重试进入解卦")}
            </button>
            <button type="button" className="sound-toggle" onClick={discardSealedReading} data-reading-start-new>
              {t("Start New Reading", "重新起卦")}
            </button>
          </div>
        </div>
      ) : null}
      {homeStage !== "landing" ? <ThreeCoinVisual
        faces={unpersistedCommit ? revealedSteps.at(-1)?.coinFaces ?? ["yang", "yang", "yang"] : visibleFaces}
        phase={homeStage === "question-confirm" ? "hero-exit" : visuallyComplete ? "exit" : visualResetting ? "reset" : motion === "casting" ? "casting" : motion === "settled" ? "settled" : "ready"}
        visualSeed={1618 + (visibleStep?.lineIndex ?? 0)}
        onReady={()=>setSceneReady(true)}
      /> : null}
      {showRitualControls ? <RitualCastPresentation zh={zh} motion={motion} steps={revealedSteps}
        visibleStep={unpersistedCommit ? null : visibleStep} complete={visuallyComplete}
        canRecord={canRecordSettledThreeCoin({motion,storageBlocked,stepCount:steps.length,revealedCount})}
        resetting={visualResetting} restartDisabled={busy || complete} onRecord={recordSettledLine} onRestart={startNewReading}
        soundOn={soundOn} onSound={()=>setSoundOn(value=>!value)} error={storageError ? (
        <div className="mb-6 rounded-[1.2rem] border border-[rgba(239,129,112,0.36)] bg-[rgba(239,129,112,0.08)] px-5 py-4" role="alert" data-three-coin-storage-error={storageError}>
          <p className="text-sm font-semibold text-[var(--danger)]">{t("This cast cannot safely continue until browser session storage is available.", "浏览器会话存储恢复前，本次起卦不能安全继续。")}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
            {unpersistedCommit
              ? zh
                ? `第 ${unpersistedCommit.step.lineIndex + 1} 爻已经得到 ${unpersistedCommit.step.lineValue}，但尚未成功保存。重试只会保存同一个结果，不会重新掷币。`
                : `Line ${unpersistedCommit.step.lineIndex + 1} was cast as ${unpersistedCommit.step.lineValue}, but it was not sealed. Retrying saves this same cast; it does not toss again.`
              : t("Quick I Ching could not read or clear the sealed browser session. Your in-memory reading has not been replaced.", "Quick I Ching 无法读取或清除已保存的浏览器会话；当前内存中的卦象没有被替换。")}
          </p>
          {!zh ? <p className="mt-2 font-mono text-xs text-[var(--ink-3)]">{storageError}</p> : null}
          <button type="button" className="sound-toggle mt-3" onClick={retryStorage}>{unpersistedCommit ? t("Retry saving this cast", "重试保存本爻") : t("Retry browser storage", "重试浏览器存储")}</button>
        </div>
      ) : null}>
        <button
                type="button"
                className="hold-button after:relative after:z-[2] after:content-[attr(data-visual-label)]"
                data-holding={motion === "holding"}
                data-visual-label={visualButtonLabel}
                aria-label={storageBlocked ? t("Browser session storage unavailable. Resolve the storage error before casting.", "浏览器会话存储不可用，请先解决存储错误。") : complete ? t("Reading complete", "起卦完成") : t("Toss three coins. Press and hold to shake, then release to cast.", "掷三枚铜钱：按住摇动，松开起爻。")}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
                onClick={onAccessibleClick}
                disabled={!visualReady || !restored || storageBlocked || visualResetting || complete || motion === "casting"}
              >
                <span className="sr-only">{t("Toss three coins", "掷三枚铜钱")}</span>
              </button>
      </RitualCastPresentation> : null}
    </section>
  );
}
