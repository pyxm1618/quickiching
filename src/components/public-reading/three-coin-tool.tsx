"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import type { UiDictionary } from "@/i18n/dictionaries/types";
import type { LocalizedReadingContent } from "@/content/mei-hua-yi-shu/types";
import { PublicReadingResult } from "@/components/public-reading/public-reading-result";
import { useQuestionFirstContext } from "@/components/public-reading/question-first";
import { generateThreeCoinLine, type CoinFace, type ThreeCoinStep } from "@/domain/casting/three-coin/algorithm";
import { buildPublicReading } from "@/domain/public-reading/reading";
import { browserRandomBit } from "@/lib/browser-random";
import {
  clearThreeCoinReading,
  readThreeCoinSession,
  readThreeCoinSteps,
  restartThreeCoinReading,
  writeThreeCoinSteps,
} from "@/lib/three-coin-session";

const ROMAN = ["I", "II", "III", "IV", "V", "VI"] as const;

type MotionState = "idle" | "holding" | "casting" | "settled";
type UnpersistedCommit = { steps: ThreeCoinStep[]; step: ThreeCoinStep };

function lineName(value: number, zh = false): string {
  if (value === 6) return zh ? "老阴 · 动爻" : "Old yin · changing";
  if (value === 7) return zh ? "少阳" : "Young yang";
  if (value === 8) return zh ? "少阴" : "Young yin";
  return zh ? "老阳 · 动爻" : "Old yang · changing";
}

function storageErrorCode(error: unknown): string {
  return error instanceof Error ? error.message : "THREE_COIN_SESSION_UNAVAILABLE";
}

function CashCoin({ face, index, zh = false }: { face: CoinFace; index: number; zh?: boolean }) {
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
          <span className="ritual-coin-mint m1 before:content-[attr(data-visual-label)]" data-visual-label={zh ? "宝" : "BOO"} />
          <span className="ritual-coin-mint m2 before:content-[attr(data-visual-label)]" data-visual-label={zh ? "源" : "YUN"} />
        </div>
      </div>
    </div>
  );
}

export function ThreeCoinTool({
  compactIntro = false,
  question: questionProp,
  onNewReading: onNewReadingProp,
  dictionary = EN_UI_DICTIONARY,
  localizedContent,
}: {
  compactIntro?: boolean;
  question?: string;
  onNewReading?: () => void;
  dictionary?: UiDictionary;
  localizedContent?: LocalizedReadingContent;
}) {
  const questionContext = useQuestionFirstContext();
  const question = questionProp ?? questionContext?.question;
  const onNewReading = onNewReadingProp ?? (() => questionContext?.restartQuestion(true));
  const zh = dictionary.locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  const lineMarkers = zh ? ["一", "二", "三", "四", "五", "六"] as const : ROMAN;
  const [steps, setSteps] = useState<ThreeCoinStep[]>([]);
  const [readingMeta, setReadingMeta] = useState<{ id: string; createdAt: string } | null>(null);
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
  const resultNavigationStartedRef = useRef(false);

  useEffect(() => {
    try {
      const session = readThreeCoinSession();
      const stored = session?.data?.steps ?? readThreeCoinSteps();
      const migrated = stored.length > 0 ? writeThreeCoinSteps(stored) : session;
      setSteps(stored);
      setReadingMeta(migrated ? { id: migrated.id, createdAt: migrated.createdAt } : null);
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
    ? t("Browser storage unavailable", "浏览器存储不可用")
    : motion === "casting"
      ? t("Coins are settling…", "铜钱正在落定…")
      : complete
        ? t("Reading complete", "起卦完成")
        : t("Press & hold to shake · release to cast", "按住摇动 · 松开起爻");
  const publicReading = useMemo(() => complete && readingMeta
    ? buildPublicReading({
        id: readingMeta.id,
        createdAt: readingMeta.createdAt,
        method: "three-coin",
        question,
        lineValuesBottomUp: lines,
        evidence: { kind: "three-coin", steps },
      })
    : null, [complete, question, readingMeta, steps, lines]);

  useEffect(() => {
    if (
      !restored ||
      !complete ||
      !visuallyComplete ||
      !readingMeta ||
      storageBlocked ||
      unpersistedCommit ||
      resultNavigationStartedRef.current
    ) return;

    resultNavigationStartedRef.current = true;
    window.location.assign(zh ? "/zh/readings/three-coin/result" : "/readings/three-coin/result");
  }, [complete, readingMeta, restored, storageBlocked, unpersistedCommit, visuallyComplete, zh]);

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
      const session = writeThreeCoinSteps(committedSteps);
      setReadingMeta({ id: session.id, createdAt: session.createdAt });
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

    if (steps.length === 0 && questionContext?.freezeCoreQuestion() === false) return;
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
      const session = readThreeCoinSession();
      const stored = session?.data?.steps ?? readThreeCoinSteps();
      setSteps(stored);
      setReadingMeta(session ? { id: session.id, createdAt: session.createdAt } : null);
      setRevealedCount(stored.length);
      setStorageError(null);
    } catch (error: unknown) {
      setStorageError(storageErrorCode(error));
    }
  }

  function reset(preserveQuestion = false) {
    try {
      if (preserveQuestion) restartThreeCoinReading();
      else clearThreeCoinReading();
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
    setReadingMeta(null);
    setSteps([]);
  }

  function startNewReading() {
    reset(false);
    onNewReading?.();
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
          <p className="mystic-kicker">{t("Three-Coin Method", "三枚铜钱起卦")}</p>
          <h2 id="three-coin-tool-title" className="mt-2 font-display text-3xl font-normal tracking-[-0.03em] sm:text-4xl">{t("Cast six lines, bottom to top", "自下而上起出六爻")}</h2>
          {!compactIntro ? (
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-2)]">{t("Each toss uses three fair browser-crypto bits. Heads/yang count as 3, tails/yin as 2, producing 6, 7, 8, or 9. Repeat six times from the bottom upward; a line is sealed only after its browser-session write succeeds.", "每一爻同时掷三枚铜钱，阳面记 3、阴面记 2，得到 6、7、8 或 9。共起六次，从初爻到上爻依次形成卦象；每一爻只有在浏览器会话成功保存后才算落定。")}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="ritual-progress-badge" style={{ textTransform: "none" }}>{revealedCount} / 6 {t("lines", "爻")}</span>
          <button type="button" className="sound-toggle" onClick={() => setSoundOn((value) => !value)} aria-pressed={soundOn}>{soundOn ? t("Sound on", "声音开") : t("Sound off", "声音关")}</button>
        </div>
      </div>

      {storageError ? (
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
      ) : null}

      <div className="ritual-wrap">
        <div className="ritual-stage">
          <div className="ritual-progress">
            <div>
              <p className="mystic-kicker">{visuallyComplete ? t("Your hexagram is formed", "卦象已经形成") : t("Casting in progress", "正在起卦")}</p>
              <p className="mt-1 text-sm text-[var(--ink-2)]"><strong className="text-white">{visuallyComplete ? t("Six lines sealed", "六爻已落定") : (zh ? `第 ${revealedCount + 1} 爻 / 共 6 爻` : `Line ${revealedCount + 1} of 6`)}</strong>{!visuallyComplete && revealedCount < 3 ? t(" · forming the lower trigram", " · 正在形成下卦") : !visuallyComplete ? t(" · forming the upper trigram", " · 正在形成上卦") : ""}</p>
            </div>
          </div>

          <div className="mx-auto mt-7 w-full max-w-[440px]">
            <HexagramLines lines={revealedLines} sealedCount={revealedCount} animateLast size="lg" showLabels locale={dictionary.locale} />
          </div>

          <div className="coin-motion-stage" data-motion={motion} aria-label={t("Three-coin casting chamber", "三枚铜钱起卦区")}>
            <div className="coin-palm" aria-hidden="true" />
            {visibleFaces.map((face, index) => <CashCoin key={index} face={face} index={index} zh={zh} />)}
            <div className="coin-energy" aria-hidden="true" />
            <div className="coin-motion-result" aria-live="polite">
              {!unpersistedCommit && motion !== "casting" && visibleStep ? <><strong>{visibleStep.lineValue} · {lineName(visibleStep.lineValue, zh)}</strong><span>{zh ? `第 ${visibleStep.lineIndex + 1} 爻已落定` : `line ${visibleStep.lineIndex + 1} sealed`}</span></> : null}
            </div>
          </div>

          {visuallyComplete ? (
            <div className="hold-zone">
              <div className="mx-auto max-w-xl rounded-[1.4rem] border border-[rgba(232,198,122,0.24)] bg-[rgba(232,198,122,0.055)] px-5 py-6 text-center">
                <p className="mystic-kicker">{t("Six lines complete", "六爻已完成")}</p>
                <h3 className="mt-2 font-display text-2xl font-normal text-[var(--gold-2)] sm:text-3xl">{t("Your hexagram is formed", "卦象已经形成")}</h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[var(--ink-2)]">{t("The six sealed lines are ready. Their core question is locked to the first cast; start a new reading to ask a different question.", "六爻已经落定，核心问题已与第一次起爻绑定；如需换问题，请开始新起卦。")}</p>
              </div>
            </div>
          ) : (
            <div className="hold-zone">
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
                disabled={!restored || storageBlocked || complete || motion === "casting"}
              >
                <span className="sr-only">{t("Toss three coins", "掷三枚铜钱")}</span>
              </button>
              <p className="hold-hint">{t("All three coins remain together until you release them.", "按住时三枚铜钱一起摇动，松开后同时落定。")}</p>
            </div>
          )}
        </div>

        <aside className="ritual-sidebar" aria-label={t("Casting progress and completed toss history", "起卦进度与掷币记录")}>
          <p className="mystic-kicker">{t("Ritual map", "六爻进度")}</p>
          <div className="ritual-map">
            {Array.from({ length: 6 }, (_, index) => {
              const step = revealedSteps[index];
              const state = step ? "done" : index === revealedCount && !visuallyComplete ? "current" : "waiting";
              return (
                <div key={index} className="ritual-map-step" data-state={state}>
                  <span className="ritual-map-n">{lineMarkers[index]}</span>
                  <div>
                    <p style={{ margin: "1px 0 3px", color: "inherit", fontSize: 13, fontWeight: 650, lineHeight: "inherit" }}>{step ? (zh ? `第 ${index + 1} 爻已落定` : `Line ${index + 1} sealed`) : index === revealedCount && !visuallyComplete ? (zh ? `等待起第 ${index + 1} 爻` : `Line ${index + 1} awaiting cast`) : (zh ? `第 ${index + 1} 爻` : `Line ${index + 1}`)}</p>
                    <p>{step ? `${lineName(step.lineValue, zh)} · ${zh ? "爻值" : "value"} ${step.lineValue}` : index === 2 ? t("Completes the lower trigram", "完成下卦") : index === 5 ? t("Completes the upper trigram", "完成上卦") : t("Bottom → top", "自下而上")}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cast-history">
            <div className="flex items-center justify-between gap-3">
              <p className="mystic-kicker">{t("Completed tosses", "已完成的掷币")}</p>
              {!visuallyComplete ? <button type="button" onClick={() => reset(true)} disabled={steps.length === 0 || busy} className="sound-toggle">{t("Restart casting", "重新起卦")}</button> : null}
            </div>
            {revealedSteps.length === 0 ? (
              <p className="mt-3 text-xs leading-6 text-[var(--ink-3)]">{t("The first toss becomes line 1 at the bottom of the hexagram.", "第一次掷币形成最下方的初爻，之后依次向上。")}</p>
            ) : (
              <ol aria-label={t("Completed coin tosses", "已完成的掷币记录")}>
                {revealedSteps.map((step) => (
                  <li key={step.lineIndex}>
                    <span>{zh ? `第 ${step.lineIndex + 1} 爻：${step.coinFaces.map((face) => face === "yang" ? "阳" : "阴").join(" · ")}` : `Line ${step.lineIndex + 1}: ${step.coinFaces.join(" · ")}`}</span>
                    <strong>{step.lineValue}</strong>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
      {publicReading ? <PublicReadingResult reading={publicReading} onNewReading={startNewReading} dictionary={dictionary} localizedContent={localizedContent} /> : null}
    </section>
  );
}
