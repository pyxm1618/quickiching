"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import { generateThreeCoinLine, type CoinFace, type ThreeCoinStep } from "@/domain/casting/three-coin/algorithm";
import { browserRandomBit } from "@/lib/browser-random";
import {
  clearThreeCoinReading,
  readThreeCoinSteps,
  writeThreeCoinSteps,
} from "@/lib/three-coin-session";

const ROMAN = ["I", "II", "III", "IV", "V", "VI"] as const;

type MotionState = "idle" | "holding" | "casting" | "settled";
type UnpersistedCommit = { steps: ThreeCoinStep[]; step: ThreeCoinStep };

function lineName(value: number): string {
  if (value === 6) return "Old yin · changing";
  if (value === 7) return "Young yang";
  if (value === 8) return "Young yin";
  return "Old yang · changing";
}

function storageErrorCode(error: unknown): string {
  return error instanceof Error ? error.message : "THREE_COIN_SESSION_UNAVAILABLE";
}

function CashCoin({ face, index }: { face: CoinFace; index: number }) {
  return (
    <div className={`ritual-coin-shell c${index + 1}`} aria-hidden="true">
      <div className="ritual-coin" data-face={face}>
        <div className="ritual-coin-face front">
          <span className="ritual-coin-hole" />
          <span className="ritual-coin-char top before:content-[attr(data-visual-label)]" data-visual-label="乾" />
          <span className="ritual-coin-char right before:content-[attr(data-visual-label)]" data-visual-label="通" />
          <span className="ritual-coin-char bottom before:content-[attr(data-visual-label)]" data-visual-label="寶" />
          <span className="ritual-coin-char left before:content-[attr(data-visual-label)]" data-visual-label="隆" />
        </div>
        <div className="ritual-coin-face back">
          <span className="ritual-coin-hole" />
          <span className="ritual-coin-mint m1 before:content-[attr(data-visual-label)]" data-visual-label="BOO" />
          <span className="ritual-coin-mint m2 before:content-[attr(data-visual-label)]" data-visual-label="YUN" />
        </div>
      </div>
    </div>
  );
}

export function ThreeCoinTool({ compactIntro = false }: { compactIntro?: boolean }) {
  const [steps, setSteps] = useState<ThreeCoinStep[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [restored, setRestored] = useState(false);
  const [motion, setMotion] = useState<MotionState>("idle");
  const [pendingStep, setPendingStep] = useState<ThreeCoinStep | null>(null);
  const [unpersistedCommit, setUnpersistedCommit] = useState<UnpersistedCommit | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const holdingRef = useRef(false);
  const ignoreSyntheticClickRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const shakeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const stored = readThreeCoinSteps();
      setSteps(stored);
      setRevealedCount(stored.length);
      setStorageError(null);
    } catch (error: unknown) {
      setStorageError(storageErrorCode(error));
    } finally {
      setRestored(true);
    }
  }, []);

  useEffect(() => () => {
    if (shakeIntervalRef.current) clearInterval(shakeIntervalRef.current);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    void audioRef.current?.close();
  }, []);

  const lines = useMemo(() => steps.map((step) => step.lineValue), [steps]);
  const revealedSteps = useMemo(() => steps.slice(0, revealedCount), [steps, revealedCount]);
  const revealedLines = useMemo(() => revealedSteps.map((step) => step.lineValue), [revealedSteps]);
  const complete = lines.length === 6;
  const visuallyComplete = revealedCount === 6;
  const visibleStep = unpersistedCommit?.step ?? pendingStep ?? revealedSteps.at(-1) ?? null;
  const visibleFaces: readonly [CoinFace, CoinFace, CoinFace] = visibleStep?.coinFaces ?? ["yang", "yang", "yang"];
  const storageBlocked = storageError !== null;
  const busy = motion === "holding" || motion === "casting" || storageBlocked || !restored;
  const visualButtonLabel = storageBlocked
    ? "Browser storage unavailable"
    : motion === "casting"
      ? "Coins are settling…"
      : complete
        ? "Reading complete"
        : "Press & hold to shake · release to cast";

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
    if (!restored || storageBlocked || complete || motion === "casting" || holdingRef.current) return;
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
      setRevealedCount(committedSteps.length);
      setPendingStep(null);
      setMotion("settled");
      tone(360, 0.34, 0.023, 0, "sine");
      tone(720, 0.42, 0.01, 0.03, "sine");
      settleTimerRef.current = null;
    }, reducedMotion ? 120 : 2200);
  }

  function persistCast(committedSteps: ThreeCoinStep[], next: ThreeCoinStep) {
    try {
      writeThreeCoinSteps(committedSteps);
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

    const lineIndex = steps.length as 0 | 1 | 2 | 3 | 4 | 5;
    const next = generateThreeCoinLine(lineIndex, browserRandomBit);
    const committedSteps = [...steps, next];

    // The cast becomes authoritative at release. It is not shown as sealed until the same
    // result is durably written to this browser session; a failed write is retried, not rerolled.
    persistCast(committedSteps, next);
  }

  function retryStorage() {
    if (unpersistedCommit) {
      persistCast(unpersistedCommit.steps, unpersistedCommit.step);
      return;
    }

    try {
      const stored = readThreeCoinSteps();
      setSteps(stored);
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
    setSteps([]);
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
    if (!restored || storageBlocked || holdingRef.current || complete || motion === "casting") return;
    beginHold();
    releaseCast();
  }

  return (
    <section data-realm="chamber" aria-labelledby="three-coin-tool-title">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mystic-kicker">Three-Coin Method</p>
          <h2 id="three-coin-tool-title" className="mt-2 font-display text-3xl font-normal tracking-[-0.03em] sm:text-4xl">Cast six lines, bottom to top</h2>
          {!compactIntro ? (
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-2)]">Each toss uses three fair browser-crypto bits. Heads/yang count as 3, tails/yin as 2, producing 6, 7, 8, or 9. Repeat six times from the bottom upward; a line is sealed only after its browser-session write succeeds.</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="ritual-progress-badge" style={{ textTransform: "none" }}>{revealedCount} / 6 lines</span>
          <button type="button" className="sound-toggle" onClick={() => setSoundOn((value) => !value)} aria-pressed={soundOn}>{soundOn ? "Sound on" : "Sound off"}</button>
        </div>
      </div>

      {storageError ? (
        <div className="mb-6 rounded-[1.2rem] border border-[rgba(239,129,112,0.36)] bg-[rgba(239,129,112,0.08)] px-5 py-4" role="alert" data-three-coin-storage-error={storageError}>
          <p className="text-sm font-semibold text-[var(--danger)]">This cast cannot safely continue until browser session storage is available.</p>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
            {unpersistedCommit
              ? `Line ${unpersistedCommit.step.lineIndex + 1} was cast as ${unpersistedCommit.step.lineValue}, but it was not sealed. Retrying saves this same cast; it does not toss again.`
              : "Quick I Ching could not read or clear the sealed browser session. Your in-memory reading has not been replaced."}
          </p>
          <p className="mt-2 font-mono text-xs text-[var(--ink-3)]">{storageError}</p>
          <button type="button" className="sound-toggle mt-3" onClick={retryStorage}>{unpersistedCommit ? "Retry saving this cast" : "Retry browser storage"}</button>
        </div>
      ) : null}

      <div className="ritual-wrap">
        <div className="ritual-stage">
          <div className="ritual-progress">
            <div>
              <p className="mystic-kicker">{visuallyComplete ? "Your hexagram is formed" : "Casting in progress"}</p>
              <p className="mt-1 text-sm text-[var(--ink-2)]"><strong className="text-white">{visuallyComplete ? "Six lines sealed" : `Line ${revealedCount + 1} of 6`}</strong>{!visuallyComplete && revealedCount < 3 ? " · forming the lower trigram" : !visuallyComplete ? " · forming the upper trigram" : ""}</p>
            </div>
          </div>

          <div className="mx-auto mt-7 w-full max-w-[440px]">
            <HexagramLines lines={revealedLines} sealedCount={revealedCount} animateLast size="lg" showLabels />
          </div>

          <div className="coin-motion-stage" data-motion={motion} aria-label="Three-coin casting chamber">
            <div className="coin-palm" aria-hidden="true" />
            {visibleFaces.map((face, index) => <CashCoin key={index} face={face} index={index} />)}
            <div className="coin-energy" aria-hidden="true" />
            <div className="coin-motion-result" aria-live="polite">
              {!unpersistedCommit && motion !== "casting" && visibleStep ? <><strong>{visibleStep.lineValue} · {lineName(visibleStep.lineValue)}</strong><span>line {visibleStep.lineIndex + 1} sealed</span></> : null}
            </div>
          </div>

          {visuallyComplete ? (
            <div className="hold-zone">
              <div className="mx-auto max-w-xl rounded-[1.4rem] border border-[rgba(232,198,122,0.24)] bg-[rgba(232,198,122,0.055)] px-5 py-6 text-center">
                <p className="mystic-kicker">Six lines complete</p>
                <h3 className="mt-2 font-display text-2xl font-normal text-[var(--gold-2)] sm:text-3xl">Your hexagram is formed</h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[var(--ink-2)]">The six sealed lines are ready. Open the full free reading without changing this cast.</p>
                <Link
                  href="/readings/three-coin/result"
                  className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full border border-[rgba(232,198,122,0.46)] bg-[linear-gradient(135deg,rgba(232,198,122,0.18),rgba(137,233,227,0.07))] px-6 py-3 font-semibold text-[var(--gold-2)] transition hover:-translate-y-px hover:border-[rgba(232,198,122,0.72)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--cyan)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  Reveal Your Reading
                </Link>
              </div>
            </div>
          ) : (
            <div className="hold-zone">
              <button
                type="button"
                className="hold-button after:relative after:z-[2] after:content-[attr(data-visual-label)]"
                data-holding={motion === "holding"}
                data-visual-label={visualButtonLabel}
                aria-label={storageBlocked ? "Browser session storage unavailable. Resolve the storage error before casting." : complete ? "Reading complete" : "Toss three coins. Press and hold to shake, then release to cast."}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
                onClick={onAccessibleClick}
                disabled={!restored || storageBlocked || complete || motion === "casting"}
              >
                <span className="sr-only">Toss three coins</span>
              </button>
              <p className="hold-hint">All three coins remain together until you release them.</p>
            </div>
          )}
        </div>

        <aside className="ritual-sidebar" aria-label="Casting progress and completed toss history">
          <p className="mystic-kicker">Ritual map</p>
          <div className="ritual-map">
            {Array.from({ length: 6 }, (_, index) => {
              const step = revealedSteps[index];
              const state = step ? "done" : index === revealedCount && !visuallyComplete ? "current" : "waiting";
              return (
                <div key={index} className="ritual-map-step" data-state={state}>
                  <span className="ritual-map-n">{ROMAN[index]}</span>
                  <div>
                    <p style={{ margin: "1px 0 3px", color: "inherit", fontSize: 13, fontWeight: 650, lineHeight: "inherit" }}>{step ? `Line ${index + 1} sealed` : index === revealedCount && !visuallyComplete ? `Line ${index + 1} awaiting cast` : `Line ${index + 1}`}</p>
                    <p>{step ? `${lineName(step.lineValue)} · value ${step.lineValue}` : index === 2 ? "Completes the lower trigram" : index === 5 ? "Completes the upper trigram" : "Bottom → top"}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cast-history">
            <div className="flex items-center justify-between gap-3">
              <p className="mystic-kicker">Completed tosses</p>
              {!visuallyComplete ? <button type="button" onClick={reset} disabled={steps.length === 0 || busy} className="sound-toggle">New reading</button> : null}
            </div>
            {revealedSteps.length === 0 ? (
              <p className="mt-3 text-xs leading-6 text-[var(--ink-3)]">The first toss becomes line 1 at the bottom of the hexagram.</p>
            ) : (
              <ol aria-label="Completed coin tosses">
                {revealedSteps.map((step) => (
                  <li key={step.lineIndex}>
                    <span>Line {step.lineIndex + 1}: {step.coinFaces.join(" · ")}</span>
                    <strong>{step.lineValue}</strong>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
