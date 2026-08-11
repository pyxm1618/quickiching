"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import { ReadingResult } from "@/components/public-reading/reading-result";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { generateThreeCoinLine, type CoinFace, type ThreeCoinStep } from "@/domain/casting/three-coin/algorithm";
import { browserRandomBit } from "@/lib/browser-random";

const STORAGE_KEY = "quickiching:public-v1:three-coin";
const ROMAN = ["I", "II", "III", "IV", "V", "VI"] as const;

type MotionState = "idle" | "holding" | "casting" | "settled";

function readStoredSteps(): ThreeCoinStep[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ThreeCoinStep[];
    if (!Array.isArray(parsed) || parsed.length > 6) return [];
    return parsed.every((step, index) => step.lineIndex === index && [6, 7, 8, 9].includes(step.lineValue)) ? parsed : [];
  } catch {
    return [];
  }
}

function lineName(value: number): string {
  if (value === 6) return "Old yin · changing";
  if (value === 7) return "Young yang";
  if (value === 8) return "Young yin";
  return "Old yang · changing";
}

function CashCoin({ face, index }: { face: CoinFace; index: number }) {
  return (
    <div className={`ritual-coin-shell c${index + 1}`} aria-hidden="true">
      <div className="ritual-coin" data-face={face}>
        <div className="ritual-coin-face front">
          <span className="ritual-coin-hole" />
          <span className="ritual-coin-char top">乾</span>
          <span className="ritual-coin-char right">通</span>
          <span className="ritual-coin-char bottom">寶</span>
          <span className="ritual-coin-char left">隆</span>
        </div>
        <div className="ritual-coin-face back">
          <span className="ritual-coin-hole" />
          <span className="ritual-coin-mint m1">BOO</span>
          <span className="ritual-coin-mint m2">YUN</span>
        </div>
      </div>
    </div>
  );
}

export function ThreeCoinTool({ compactIntro = false }: { compactIntro?: boolean }) {
  const [steps, setSteps] = useState<ThreeCoinStep[]>([]);
  const [restored, setRestored] = useState(false);
  const [motion, setMotion] = useState<MotionState>("idle");
  const [pendingStep, setPendingStep] = useState<ThreeCoinStep | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const holdingRef = useRef(false);
  const ignoreSyntheticClickRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const shakeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSteps(readStoredSteps());
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    if (steps.length === 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(steps));
  }, [steps, restored]);

  useEffect(() => () => {
    if (shakeIntervalRef.current) clearInterval(shakeIntervalRef.current);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    void audioRef.current?.close();
  }, []);

  const lines = useMemo(() => steps.map((step) => step.lineValue), [steps]);
  const complete = lines.length === 6;
  const result = complete ? buildHexagramResult({ lineValuesBottomUp: lines, method: "three_coin" }) : null;
  const visibleStep = pendingStep ?? steps.at(-1) ?? null;
  const visibleFaces: readonly [CoinFace, CoinFace, CoinFace] = visibleStep?.coinFaces ?? ["yang", "yang", "yang"];
  const busy = motion === "holding" || motion === "casting";
  const visualButtonLabel = complete
    ? "Reading complete"
    : motion === "casting"
      ? "Coins are settling…"
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

  function beginHold() {
    if (complete || motion === "casting" || holdingRef.current) return;
    holdingRef.current = true;
    setPendingStep(null);
    setMotion("holding");
    shakeTick();
    shakeIntervalRef.current = setInterval(shakeTick, 155);
  }

  function releaseCast() {
    if (!holdingRef.current || complete) return;
    holdingRef.current = false;
    if (shakeIntervalRef.current) {
      clearInterval(shakeIntervalRef.current);
      shakeIntervalRef.current = null;
    }

    const lineIndex = steps.length as 0 | 1 | 2 | 3 | 4 | 5;
    const next = generateThreeCoinLine(lineIndex, browserRandomBit);
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
      setSteps((current) => [...current, next]);
      setMotion("settled");
      tone(360, 0.34, 0.023, 0, "sine");
      tone(720, 0.42, 0.01, 0.03, "sine");
      settleTimerRef.current = null;
    }, reducedMotion ? 120 : 2200);
  }

  function reset() {
    holdingRef.current = false;
    ignoreSyntheticClickRef.current = false;
    if (shakeIntervalRef.current) clearInterval(shakeIntervalRef.current);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    shakeIntervalRef.current = null;
    settleTimerRef.current = null;
    setPendingStep(null);
    setMotion("idle");
    setSteps([]);
    sessionStorage.removeItem(STORAGE_KEY);
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
    ignoreSyntheticClickRef.current = false;
    releaseCast();
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
    if (holdingRef.current || complete || motion === "casting") return;
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
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-2)]">Each toss uses three fair browser-crypto bits. Heads/yang count as 3, tails/yin as 2, producing 6, 7, 8, or 9. A completed line is sealed; only a full reset starts a new reading.</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="ritual-progress-badge">{steps.length} / 6 lines</span>
          <button type="button" className="sound-toggle" onClick={() => setSoundOn((value) => !value)} aria-pressed={soundOn}>{soundOn ? "Sound on" : "Sound off"}</button>
        </div>
      </div>

      <div className="ritual-wrap">
        <div className="ritual-stage">
          <div className="ritual-progress">
            <div>
              <p className="mystic-kicker">{complete ? "Reading formed" : "Casting in progress"}</p>
              <p className="mt-1 text-sm text-[var(--ink-2)]"><strong className="text-white">{complete ? "Six lines sealed" : `Line ${steps.length + 1} of 6`}</strong>{!complete && steps.length < 3 ? " · forming the lower trigram" : !complete ? " · forming the upper trigram" : ""}</p>
            </div>
          </div>

          <div className="mx-auto mt-7 w-full max-w-[440px]">
            <HexagramLines lines={lines} sealedCount={steps.length} animateLast size="lg" showLabels />
          </div>

          <div className="coin-motion-stage" data-motion={motion} aria-label="Three-coin casting chamber">
            <div className="coin-palm" aria-hidden="true" />
            {visibleFaces.map((face, index) => <CashCoin key={index} face={face} index={index} />)}
            <div className="coin-energy" aria-hidden="true" />
            <div className="coin-motion-result" aria-live="polite">
              {visibleStep ? <><strong>{visibleStep.lineValue} · {lineName(visibleStep.lineValue)}</strong><span>line {visibleStep.lineIndex + 1} sealed</span></> : null}
            </div>
          </div>

          <div className="hold-zone">
            <button
              type="button"
              className="hold-button after:relative after:z-[2] after:content-[attr(data-visual-label)]"
              data-holding={motion === "holding"}
              data-visual-label={visualButtonLabel}
              aria-label={complete ? "Reading complete" : "Toss three coins. Press and hold to shake, then release to cast."}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onKeyDown={onKeyDown}
              onKeyUp={onKeyUp}
              onClick={onAccessibleClick}
              disabled={complete || motion === "casting"}
            >
              <span className="sr-only">Toss three coins</span>
            </button>
            <p className="hold-hint">All three coins remain together until you release them.</p>
          </div>
        </div>

        <aside className="ritual-sidebar" aria-label="Casting progress and completed toss history">
          <p className="mystic-kicker">Ritual map</p>
          <div className="ritual-map">
            {Array.from({ length: 6 }, (_, index) => {
              const step = steps[index];
              const state = step ? "done" : index === steps.length && !complete ? "current" : "waiting";
              return (
                <div key={index} className="ritual-map-step" data-state={state}>
                  <span className="ritual-map-n">{ROMAN[index]}</span>
                  <div>
                    <h4>{step ? `Line ${index + 1} sealed` : index === steps.length && !complete ? `Line ${index + 1} awaiting cast` : `Line ${index + 1}`}</h4>
                    <p>{step ? `${lineName(step.lineValue)} · value ${step.lineValue}` : index === 2 ? "Completes the lower trigram" : index === 5 ? "Completes the upper trigram" : "Bottom → top"}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cast-history">
            <div className="flex items-center justify-between gap-3">
              <p className="mystic-kicker">Completed tosses</p>
              <button type="button" onClick={reset} disabled={steps.length === 0 || busy} className="sound-toggle">New reading</button>
            </div>
            {steps.length === 0 ? (
              <p className="mt-3 text-xs leading-6 text-[var(--ink-3)]">The first toss becomes line 1 at the bottom of the hexagram.</p>
            ) : (
              <ol aria-label="Completed coin tosses">
                {steps.map((step) => (
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

      {result ? <ReadingResult result={result} /> : null}
    </section>
  );
}
