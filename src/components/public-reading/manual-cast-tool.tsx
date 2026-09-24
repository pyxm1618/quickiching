"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import type { UiDictionary } from "@/i18n/dictionaries/types";
import type { LocalizedReadingContent } from "@/content/mei-hua-yi-shu/types";
import { PublicReadingResult } from "@/components/public-reading/public-reading-result";
import { useQuestionFirstContext } from "@/components/public-reading/question-first";
import { CLASSICAL_HEXAGRAMS } from "@/domain/public-reading/classical";
import { manualFromLineValues, manualFromPrimaryAndChangingLines } from "@/domain/public-reading/manual";
import { buildPublicReading } from "@/domain/public-reading/reading";
import type { PublicLineTuple, PublicReadingEvidence } from "@/domain/public-reading/types";
import { clearPublicReadingSession, readPublicReadingSession, writePublicReadingSession } from "@/lib/public-reading-session";

const STORAGE_KEY = "quickiching:public-v1:manual-cast";
const DEFAULT_LINE_VALUES: PublicLineTuple = [7, 7, 7, 7, 7, 7];
type ManualMode = "line-values" | "primary-changing";
type ManualFacts = {
  id: string;
  createdAt: string;
  mode: ManualMode;
  lineValuesBottomUp: PublicLineTuple;
  evidence: PublicReadingEvidence;
};
type ManualSessionData = Omit<ManualFacts, "id" | "createdAt">;

function readManualEvidence(value: unknown, mode: ManualMode): Extract<PublicReadingEvidence, { kind: "manual" }> | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { kind?: unknown; mode?: unknown; primaryHexagramNumber?: unknown; changingLines?: unknown };
  if (candidate.kind !== "manual" || candidate.mode !== mode) return null;
  if (mode === "line-values") return { kind: "manual", mode };
  if (!Number.isInteger(candidate.primaryHexagramNumber) || Number(candidate.primaryHexagramNumber) < 1 || Number(candidate.primaryHexagramNumber) > 64) return null;
  if (!Array.isArray(candidate.changingLines) || candidate.changingLines.some((line) => !Number.isInteger(line) || Number(line) < 1 || Number(line) > 6) || new Set(candidate.changingLines).size !== candidate.changingLines.length) return null;
  const changingLines = candidate.changingLines.map((line) => Number(line)).sort((left, right) => left - right);
  return { kind: "manual", mode, primaryHexagramNumber: Number(candidate.primaryHexagramNumber), changingLines };
}

function parseManualData(value: unknown): ManualSessionData | null {
  try {
    if (!value || typeof value !== "object") return null;
    const parsed = value as Partial<ManualFacts>;
    if ((parsed.mode !== "line-values" && parsed.mode !== "primary-changing") || !Array.isArray(parsed.lineValuesBottomUp) || parsed.lineValuesBottomUp.length !== 6) return null;
    const values = manualFromLineValues(parsed.lineValuesBottomUp);
    const evidence = readManualEvidence(parsed.evidence, parsed.mode);
    if (!evidence) return null;
    return { mode: parsed.mode, lineValuesBottomUp: values, evidence };
  } catch {
    return null;
  }
}

function readFacts(): ManualFacts | null {
  try {
    const session = readPublicReadingSession(STORAGE_KEY, parseManualData);
    if (!session?.data) return null;
    return { id: session.id, createdAt: session.createdAt, ...session.data };
  } catch {
    return null;
  }
}

export function ManualCastTool({
  question: questionProp,
  onNewReading: onNewReadingProp,
  dictionary = EN_UI_DICTIONARY,
  localizedContent,
}: {
  question?: string;
  onNewReading?: () => void;
  dictionary?: UiDictionary;
  localizedContent?: LocalizedReadingContent;
}) {
  const questionContext = useQuestionFirstContext();
  const question = questionProp ?? questionContext?.question;
  const onNewReading = onNewReadingProp ?? questionContext?.restartQuestion;
  const zh = dictionary.locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  const [mode, setMode] = useState<ManualMode>("line-values");
  const [lineValues, setLineValues] = useState<PublicLineTuple>(DEFAULT_LINE_VALUES);
  const [primaryHexagram, setPrimaryHexagram] = useState(1);
  const [changingLines, setChangingLines] = useState<number[]>([]);
  const [facts, setFacts] = useState<ManualFacts | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const modeTabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const restored = readFacts();
    if (restored) {
      setFacts(restored);
      setMode(restored.mode);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (facts) writePublicReadingSession(STORAGE_KEY, {
        mode: facts.mode,
        lineValuesBottomUp: facts.lineValuesBottomUp,
        evidence: facts.evidence,
      });
    } catch {
      // A manual cast remains in memory when session storage is unavailable.
    }
  }, [facts, hydrated]);

  const modeBValues = useMemo(() => manualFromPrimaryAndChangingLines(primaryHexagram, changingLines), [primaryHexagram, changingLines]);
  const publicReading = useMemo(() => facts
    ? buildPublicReading({
        id: facts.id,
        createdAt: facts.createdAt,
        method: "manual",
        question,
        lineValuesBottomUp: facts.lineValuesBottomUp,
        evidence: facts.evidence,
      })
    : null, [facts, question]);

  function updateLine(index: number, value: number) {
    setLineValues((current) => manualFromLineValues(current.map((line, lineIndex) => lineIndex === index ? value : line)));
  }

  function toggleChangingLine(position: number) {
    setChangingLines((current) => current.includes(position)
      ? current.filter((line) => line !== position)
      : [...current, position].sort((left, right) => left - right));
  }

  function cast() {
    const values = mode === "line-values" ? manualFromLineValues(lineValues) : modeBValues;
    const evidence: PublicReadingEvidence = mode === "line-values"
      ? { kind: "manual", mode: "line-values" }
      : { kind: "manual", mode: "primary-changing", primaryHexagramNumber: primaryHexagram, changingLines };
    const session = writePublicReadingSession(STORAGE_KEY, { mode, lineValuesBottomUp: values, evidence });
    setFacts({ id: session.id, createdAt: session.createdAt, mode, lineValuesBottomUp: values, evidence });
  }

  function selectMode(nextMode: ManualMode, focusIndex?: number) {
    setMode(nextMode);
    if (focusIndex !== undefined) modeTabRefs.current[focusIndex]?.focus();
  }

  function handleModeKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const modes: readonly ManualMode[] = ["line-values", "primary-changing"];
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % modes.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + modes.length) % modes.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = modes.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectMode(modes[nextIndex]!, nextIndex);
  }

  function startNewReading() {
    try {
      clearPublicReadingSession(STORAGE_KEY);
    } catch {
      // The in-memory reset still works when browser storage is unavailable.
    }
    setFacts(null);
    setChangingLines([]);
    setLineValues(DEFAULT_LINE_VALUES);
    setPrimaryHexagram(1);
    setMode("line-values");
    onNewReading?.();
  }

  return (
    <section className="mystic-card overflow-hidden p-5 sm:p-8" aria-labelledby="manual-cast-tool-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mystic-kicker">{t("Manual Cast · deterministic input", "手动起卦 · 确定性输入")}</p>
          <h2 id="manual-cast-tool-title" className="mt-2 font-display text-3xl font-normal tracking-[-.03em]">{t("Enter the six-line structure", "输入六爻结构")}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">{t("Manual Cast never rolls or samples anything. Choose six values from bottom to top, or choose a primary hexagram and the moving positions; both modes feed the same transformation engine.", "手动起卦不会生成任何随机结果。你可以自下而上输入六个爻值，也可以直接选择本卦和动爻位置；两种输入最终进入同一个卦象变化计算。")}</p>
        </div>
        <span className="ritual-progress-badge" style={{ textTransform: "none" }}>{t("No randomness", "无随机过程")}</span>
      </div>

      {!facts ? (
        <>
          <div className="mt-7 flex flex-wrap gap-3" role="tablist" aria-label={t("Manual cast input mode", "手动起卦输入方式")}>
            <button ref={(node) => { modeTabRefs.current[0] = node; }} id="manual-mode-line-values-tab" type="button" role="tab" aria-controls="manual-mode-line-values-panel" aria-selected={mode === "line-values"} tabIndex={mode === "line-values" ? 0 : -1} onClick={() => selectMode("line-values")} onKeyDown={(event) => handleModeKeyDown(event, 0)} className={mode === "line-values" ? "mystic-button" : "mystic-button-secondary"}>{t("Mode A · six values", "方式一 · 输入六个爻值")}</button>
            <button ref={(node) => { modeTabRefs.current[1] = node; }} id="manual-mode-primary-changing-tab" type="button" role="tab" aria-controls="manual-mode-primary-changing-panel" aria-selected={mode === "primary-changing"} tabIndex={mode === "primary-changing" ? 0 : -1} onClick={() => selectMode("primary-changing")} onKeyDown={(event) => handleModeKeyDown(event, 1)} className={mode === "primary-changing" ? "mystic-button" : "mystic-button-secondary"}>{t("Mode B · primary + moving", "方式二 · 本卦 + 动爻")}</button>
          </div>

          {mode === "line-values" ? (
            <div id="manual-mode-line-values-panel" role="tabpanel" aria-labelledby="manual-mode-line-values-tab" className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={t("Manual line values bottom to top", "自下而上的六爻值")}>
              {lineValues.map((value, index) => (
                <label key={index} className="mystic-card-soft p-4 text-sm">
                  <span className="mystic-kicker">{zh ? `第 ${index + 1} 爻 · ${index === 0 ? "初爻" : index === 5 ? "上爻" : ""}` : `Line ${index + 1} · ${index === 0 ? "bottom" : index === 5 ? "top" : ""}`}</span>
                  <select value={value} onChange={(event) => updateLine(index, Number(event.target.value))} className="mt-3 min-h-12 w-full rounded-2xl border border-white/[0.12] bg-[#100d18] px-4 text-[var(--ink)] outline-none focus:border-[var(--gold)]">
                    <option value={6}>{t("6 · old yin · changing", "6 · 老阴 · 动爻")}</option>
                    <option value={7}>{t("7 · young yang", "7 · 少阳")}</option>
                    <option value={8}>{t("8 · young yin", "8 · 少阴")}</option>
                    <option value={9}>{t("9 · old yang · changing", "9 · 老阳 · 动爻")}</option>
                  </select>
                </label>
              ))}
            </div>
          ) : (
            <div id="manual-mode-primary-changing-panel" role="tabpanel" aria-labelledby="manual-mode-primary-changing-tab" className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(18rem,.8fr)]">
              <div>
                <label htmlFor="manual-primary-hexagram" className="block text-sm font-semibold text-[var(--ink)]">{t("Primary hexagram", "本卦")}</label>
                <select id="manual-primary-hexagram" value={primaryHexagram} onChange={(event) => setPrimaryHexagram(Number(event.target.value))} className="mt-2 min-h-12 w-full rounded-2xl border border-white/[0.12] bg-[#100d18] px-4 text-[var(--ink)] outline-none focus:border-[var(--gold)]">
                  {CLASSICAL_HEXAGRAMS.map((hexagram) => <option key={hexagram.number} value={hexagram.number}>{hexagram.number} · {hexagram.chineseName}{zh ? "" : ` · ${hexagram.englishName}`}</option>)}
                </select>
                <p className="mt-3 text-xs leading-6 text-[var(--ink-3)]">{t("The selected hexagram supplies stable yin/yang values. A checked position becomes 6 or 9 according to that base line.", "所选本卦先提供稳定的阴阳爻结构；勾选某个位置后，该爻会按原本阴阳转换成 6 或 9 的动爻。")}</p>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Array.from({ length: 6 }, (_, index) => {
                    const position = index + 1;
                    return <label key={position} className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 text-sm"><input type="checkbox" checked={changingLines.includes(position)} onChange={() => toggleChangingLine(position)} className="h-4 w-4 accent-[var(--gold)]" />{zh ? `第 ${position} 爻` : `Line ${position}`}</label>;
                  })}
                </div>
              </div>
              <div className="mystic-card-soft p-5"><p className="mystic-kicker">{t("Mapped values · bottom to top", "映射后的爻值 · 自下而上")}</p><HexagramLines lines={[...modeBValues]} size="lg" showLabels locale={dictionary.locale} className="mt-6" /><p className="mt-4 text-center font-mono text-sm text-[var(--gold-2)]">{modeBValues.join(" · ")}</p></div>
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-3"><button type="button" onClick={cast} className="mystic-button">{t("Build reading", "生成卦象")}</button><span className="self-center text-xs text-[var(--ink-3)]">{t("Lines are always read bottom → top.", "六爻始终按自下而上的顺序读取。")}</span></div>
        </>
      ) : null}

      {publicReading ? <PublicReadingResult reading={publicReading} onNewReading={startNewReading} dictionary={dictionary} localizedContent={localizedContent} /> : null}
    </section>
  );
}
