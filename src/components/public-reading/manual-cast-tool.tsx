"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { HexagramLines, movingMark } from "@/components/hex/hexagram-lines";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import type { UiDictionary } from "@/i18n/dictionaries/types";
import { useQuestionFirstContext } from "@/components/public-reading/question-first";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import type { LineValue } from "@/domain/casting/types";
import { CLASSICAL_HEXAGRAMS, classicalHexagramByNumber } from "@/domain/public-reading/classical";
import {
  baseLineValuesForPrimaryHexagram,
  manualFromLineValues,
  manualFromPrimaryAndChangingLines,
  normalizeManualChangingLines,
} from "@/domain/public-reading/manual";
import { buildPublicReading } from "@/domain/public-reading/reading";
import { PUBLIC_METHOD_VERSIONS, type PublicLineTuple, type PublicReadingEvidence } from "@/domain/public-reading/types";
import { readPublicReadingSession, writePublicReadingSession } from "@/lib/public-reading-session";
import { completedPublicReadingPath, writeCompletedPublicReading } from "@/lib/completed-public-reading";
import { GildedTitle } from "@/components/typography/gilded-title";

const STORAGE_KEY = "quickiching:public-v1:manual-cast";
const DRAFT_STORAGE_KEY = "quickiching:public-v1:manual-cast:draft:v1";
const DEFAULT_LINE_VALUES: PublicLineTuple = [7, 7, 7, 7, 7, 7];
const LINE_POSITIONS = [6, 5, 4, 3, 2, 1] as const;
const LINE_VALUE_OPTIONS = [6, 7, 8, 9] as const;

export type ManualMode = "line-values" | "primary-changing";

type ManualFacts = {
  id: string;
  createdAt: string;
  mode: ManualMode;
  lineValuesBottomUp: PublicLineTuple;
  evidence: PublicReadingEvidence;
};

type ManualSessionData = Omit<ManualFacts, "id" | "createdAt">;

type ManualDraft = {
  schemaVersion: 1;
  questionKey: string | null;
  mode: ManualMode;
  lineValuesBottomUp: PublicLineTuple;
  primaryHexagram: number;
  changingLines: number[];
};

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

function readManualDraft(questionKey: string | null): ManualDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const candidate = JSON.parse(raw) as Partial<ManualDraft>;
    if (candidate.schemaVersion !== 1 || candidate.questionKey !== questionKey) return null;
    if (candidate.mode !== "line-values" && candidate.mode !== "primary-changing") return null;
    if (!Array.isArray(candidate.lineValuesBottomUp)) return null;
    const lineValuesBottomUp = manualFromLineValues(candidate.lineValuesBottomUp);
    if (!Number.isInteger(candidate.primaryHexagram) || Number(candidate.primaryHexagram) < 1 || Number(candidate.primaryHexagram) > 64) return null;
    if (!Array.isArray(candidate.changingLines)) return null;
    const changingLines = normalizeManualChangingLines(candidate.changingLines);
    manualFromPrimaryAndChangingLines(Number(candidate.primaryHexagram), changingLines);
    return {
      schemaVersion: 1,
      questionKey,
      mode: candidate.mode,
      lineValuesBottomUp,
      primaryHexagram: Number(candidate.primaryHexagram),
      changingLines,
    };
  } catch {
    return null;
  }
}

function writeManualDraft(draft: ManualDraft): void {
  try {
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Draft restoration is presentation-only. The authoritative cast save remains unchanged.
  }
}

function clearManualDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Best effort only; completed reading persistence remains authoritative.
  }
}

function lineMeaning(dictionary: UiDictionary, value: LineValue): string {
  if (value === 6) return dictionary.manualCast.oldYin;
  if (value === 7) return dictionary.manualCast.youngYang;
  if (value === 8) return dictionary.manualCast.youngYin;
  return dictionary.manualCast.oldYang;
}

function isYang(value: LineValue): boolean {
  return value === 7 || value === 9;
}

function linePositionLabel(dictionary: UiDictionary, position: number): string {
  return dictionary.locale === "zh-Hans" ? `第 ${position} 爻` : `Line ${position}`;
}

function ManualLineGlyph({ value }: { value: LineValue }) {
  const yang = isYang(value);
  const mark = movingMark(value);
  return (
    <span className="manual-line-glyph" data-yang={yang} data-moving={Boolean(mark)} aria-hidden="true">
      <span className="manual-line-glyph-bars">
        <i />
        {!yang ? <i /> : null}
      </span>
      <span className="manual-line-glyph-mark">{mark ?? ""}</span>
    </span>
  );
}

export function ManualSixLinesInput({
  values,
  dictionary,
  onChange,
}: {
  values: PublicLineTuple;
  dictionary: UiDictionary;
  onChange: (lineIndex: number, value: LineValue) => void;
}) {
  const copy = dictionary.manualCast;
  return (
    <section className="manual-mode-panel manual-six-lines-panel" id="manual-mode-line-values-panel" role="tabpanel" aria-labelledby="manual-mode-line-values-tab" data-manual-line-values-panel>
      <div className="manual-mode-heading">
        <span className="manual-heading-ornament" aria-hidden="true" />
        <GildedTitle as="h2" size="md">{copy.enterSixLines}</GildedTitle>
        <span className="manual-heading-ornament manual-heading-ornament-right" aria-hidden="true" />
        <p>{copy.enterSixLinesHelp}</p>
      </div>

      <div className="manual-lines-frame">
        <div className="manual-direction-rail" aria-hidden="true">
          <span>{copy.top}</span>
          <i />
          <span>{copy.bottom}</span>
        </div>
        <div className="manual-lines-list">
          {LINE_POSITIONS.map((position) => {
            const lineIndex = position - 1;
            const value = values[lineIndex] as LineValue;
            const moving = value === 6 || value === 9;
            return (
              <fieldset className="manual-line-row" key={position} data-line-row-position={position}>
                <legend className="sr-only">{copy.line} {position}</legend>
                <span className="manual-line-badge">{linePositionLabel(dictionary, position)}</span>
                <ManualLineGlyph value={value} />
                <span className="manual-line-meaning">
                  <strong>{value}</strong>
                  <span aria-hidden="true"> · </span>
                  {lineMeaning(dictionary, value)}
                  {moving ? <em> · {copy.changing}</em> : null}
                </span>
                <div className="manual-value-buttons" role="group" aria-label={copy.chooseValueForLine.replace("{line}", String(position))}>
                  {LINE_VALUE_OPTIONS.map((option) => (
                    <button
                      type="button"
                      key={option}
                      data-line-position={position}
                      data-line-value={option}
                      data-selected={value === option}
                      aria-pressed={value === option}
                      aria-label={linePositionLabel(dictionary, position) + " · " + String(option) + " · " + lineMeaning(dictionary, option)}
                      onClick={() => onChange(lineIndex, option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
      </div>

      <LineValueGuide dictionary={dictionary} />
    </section>
  );
}

function LineValueGuide({ dictionary }: { dictionary: UiDictionary }) {
  const copy = dictionary.manualCast;
  return (
    <div className="manual-line-value-guide" aria-label={copy.lineValueGuide}>
      <span className="manual-guide-title">{copy.lineValueGuide}</span>
      {LINE_VALUE_OPTIONS.map((value) => (
        <span className="manual-guide-item" key={value}>
          <b>{value}</b>
          <span>{lineMeaning(dictionary, value)}{value === 6 || value === 9 ? <em>{copy.changingShort}</em> : null}</span>
        </span>
      ))}
      <span className="manual-guide-note">{copy.changingGuide}</span>
    </div>
  );
}

export function ManualHexagramPicker({
  dictionary,
  selected,
  open,
  onOpenChange,
  onSelect,
}: {
  dictionary: UiDictionary;
  selected: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (number: number) => void;
}) {
  const copy = dictionary.manualCast;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedHexagram = classicalHexagramByNumber(selected);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => optionRefs.current[selected - 1]?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, selected]);

  function focusOption(index: number) {
    const normalized = (index + CLASSICAL_HEXAGRAMS.length) % CLASSICAL_HEXAGRAMS.length;
    optionRefs.current[normalized]?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenChange(true);
    }
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      focusOption(index + 1);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      focusOption(index - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusOption(CLASSICAL_HEXAGRAMS.length - 1);
    }
  }

  return (
    <div className="manual-hexagram-picker">
      <button
        ref={triggerRef}
        type="button"
        className="manual-hexagram-picker-trigger"
        data-hexagram-picker-trigger
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="manual-hexagram-listbox"
        onClick={() => onOpenChange(!open)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="manual-picker-icon" aria-hidden="true">☰</span>
        <span>{selectedHexagram.number} · {selectedHexagram.chineseName}{dictionary.locale === "en" ? " · " + selectedHexagram.englishName : ""}</span>
        <ChevronDown size={18} strokeWidth={1.6} aria-hidden="true" />
      </button>
      {open ? (
        <div className="manual-hexagram-picker-popover" id="manual-hexagram-listbox" role="listbox" aria-label={copy.selectPrimaryHexagram}>
          {CLASSICAL_HEXAGRAMS.map((hexagram, index) => (
            <button
              ref={(node) => { optionRefs.current[index] = node; }}
              type="button"
              role="option"
              aria-selected={hexagram.number === selected}
              tabIndex={hexagram.number === selected ? 0 : -1}
              key={hexagram.number}
              data-hexagram-number={hexagram.number}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              onClick={() => {
                onSelect(hexagram.number);
                onOpenChange(false);
                triggerRef.current?.focus();
              }}
            >
              <span className="manual-picker-number">{hexagram.number}</span>
              <span className="manual-picker-name">
                <b>{hexagram.chineseName}</b>
                <span>{dictionary.locale === "zh-Hans" ? `第 ${hexagram.number} 卦` : hexagram.englishName}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ManualHexagramMovingInput({
  dictionary,
  primaryHexagram,
  changingLines,
  lineValues,
  relatingHexagramNumber,
  relatingLineValues,
  pickerOpen,
  onPickerOpenChange,
  onPrimaryChange,
  onToggleChangingLine,
}: {
  dictionary: UiDictionary;
  primaryHexagram: number;
  changingLines: number[];
  lineValues: PublicLineTuple;
  relatingHexagramNumber: number | null;
  relatingLineValues: PublicLineTuple | null;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  onPrimaryChange: (number: number) => void;
  onToggleChangingLine: (position: number) => void;
}) {
  const copy = dictionary.manualCast;
  const primary = classicalHexagramByNumber(primaryHexagram);
  const relating = relatingHexagramNumber ? classicalHexagramByNumber(relatingHexagramNumber) : null;

  return (
    <section className="manual-mode-panel manual-hexagram-moving-panel" id="manual-mode-primary-changing-panel" role="tabpanel" aria-labelledby="manual-mode-primary-changing-tab" data-manual-primary-changing-panel>
      <div className="manual-mode-heading">
        <span className="manual-heading-ornament" aria-hidden="true" />
        <GildedTitle as="h2" size="md">{copy.chooseHexagramMovingLines}</GildedTitle>
        <span className="manual-heading-ornament manual-heading-ornament-right" aria-hidden="true" />
        <p>{copy.chooseHexagramMovingLinesHelp}</p>
      </div>

      <div className="manual-hexagram-frame">
        <div className="manual-hexagram-frame-title">
          <span>{copy.primaryHexagram}</span>
          <ManualHexagramPicker
            dictionary={dictionary}
            selected={primaryHexagram}
            open={pickerOpen}
            onOpenChange={onPickerOpenChange}
            onSelect={onPrimaryChange}
          />
          <span>{copy.relatingHexagram} <small>{copy.preview}</small></span>
        </div>

        <div className="manual-hexagram-layout">
          <div className="manual-hexagram-identity">
            <div className="manual-hexagram-seal" aria-hidden="true"><span>{primary.chineseName}</span></div>
            <strong>{primary.number} · {primary.chineseName}</strong>
            <em>{dictionary.locale === "zh-Hans" ? `第 ${primary.number} 卦` : primary.englishName}</em>
          </div>

          <div className="manual-moving-lines">
            <div className="manual-moving-direction" aria-hidden="true"><span>{copy.top}</span><i /><span>{copy.bottom}</span></div>
            <div className="manual-moving-line-list" role="group" aria-label={copy.selectMovingLines}>
              {LINE_POSITIONS.map((position) => {
                const value = lineValues[position - 1] as LineValue;
                const moving = changingLines.includes(position);
                return (
                  <button
                    type="button"
                    key={position}
                    className="manual-moving-line-button"
                    data-moving-line-position={position}
                    data-moving={moving}
                    aria-pressed={moving}
                    aria-label={copy.toggleMovingLine.replace("{line}", String(position))}
                    onClick={() => onToggleChangingLine(position)}
                  >
                    <span className="manual-line-badge">{linePositionLabel(dictionary, position)}</span>
                    <ManualLineGlyph value={value} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="manual-transform-arrow" aria-hidden="true">→</div>

          <div className="manual-relating-preview" data-relating-hexagram-number={relatingHexagramNumber ?? "none"}>
            {relating && relatingLineValues ? (
              <>
                <div className="manual-hexagram-seal" aria-hidden="true"><span>{relating.chineseName}</span></div>
                <strong>{relating.number} · {relating.chineseName}</strong>
                <em>{dictionary.locale === "zh-Hans" ? `第 ${relating.number} 卦` : relating.englishName}</em>
                <HexagramLines lines={[...relatingLineValues]} size="md" locale={dictionary.locale} className="manual-relating-lines" />
              </>
            ) : (
              <div className="manual-no-relating">
                <span className="manual-empty-hexagram" aria-hidden="true">
                  {LINE_POSITIONS.map((position) => <i key={position} />)}
                </span>
                <strong>{copy.noRelatingHexagram}</strong>
                <p>{copy.noRelatingHelp}</p>
              </div>
            )}
          </div>
        </div>

        <div className="manual-moving-summary">
          <span aria-hidden="true">ⓘ</span>
          <p>{copy.selectMovingLinesHint}</p>
          <strong>{copy.movingLines}: <b>{changingLines.length}</b></strong>
        </div>
      </div>

      <LineValueGuide dictionary={dictionary} />
    </section>
  );
}

export function ManualCastTool({
  question: questionProp,
  dictionary = EN_UI_DICTIONARY,
}: {
  question?: string;
  dictionary?: UiDictionary;
}) {
  const router = useRouter();
  const questionContext = useQuestionFirstContext();
  const question = questionProp ?? questionContext?.question;
  const copy = dictionary.manualCast;
  const zh = dictionary.locale === "zh-Hans";
  const [mode, setMode] = useState<ManualMode>("line-values");
  const [lineValues, setLineValues] = useState<PublicLineTuple>(DEFAULT_LINE_VALUES);
  const [primaryHexagram, setPrimaryHexagram] = useState(1);
  const [changingLines, setChangingLines] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const modeTabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const restored = readFacts();
    if (restored) {
      setMode(restored.mode);
      setLineValues(restored.lineValuesBottomUp);
      if (restored.evidence.kind === "manual" && restored.evidence.mode === "primary-changing") {
        setPrimaryHexagram(restored.evidence.primaryHexagramNumber ?? 1);
        setChangingLines([...(restored.evidence.changingLines ?? [])]);
      }
      try {
        const reading = buildPublicReading({
          id: restored.id,
          createdAt: restored.createdAt,
          method: "manual",
          question,
          lineValuesBottomUp: restored.lineValuesBottomUp,
          evidence: restored.evidence,
        });
        writeCompletedPublicReading(reading);
        router.replace(completedPublicReadingPath(reading.id, zh));
      } catch {
        // Keep the current canonical session so Continue can retry the handoff.
      }
      return;
    }

    const draft = readManualDraft(question ?? null);
    if (draft) {
      setMode(draft.mode);
      setLineValues(draft.lineValuesBottomUp);
      setPrimaryHexagram(draft.primaryHexagram);
      setChangingLines(draft.changingLines);
    }
    setDraftReady(true);
  }, [question, router, zh]);

  useEffect(() => {
    if (!draftReady) return;
    writeManualDraft({
      schemaVersion: 1,
      questionKey: question ?? null,
      mode,
      lineValuesBottomUp: lineValues,
      primaryHexagram,
      changingLines,
    });
  }, [changingLines, draftReady, lineValues, mode, primaryHexagram, question]);

  const modeBValues = useMemo(
    () => manualFromPrimaryAndChangingLines(primaryHexagram, changingLines),
    [primaryHexagram, changingLines],
  );

  const modeBResult = useMemo(
    () => buildHexagramResult({
      lineValuesBottomUp: modeBValues,
      method: "manual",
      algorithmVersion: PUBLIC_METHOD_VERSIONS.manual,
    }),
    [modeBValues],
  );

  const relatingLineValues = useMemo(
    () => modeBResult.relatingHexagramNumber
      ? baseLineValuesForPrimaryHexagram(modeBResult.relatingHexagramNumber)
      : null,
    [modeBResult.relatingHexagramNumber],
  );

  function updateLine(index: number, value: LineValue) {
    setLineValues((current) => manualFromLineValues(current.map((line, lineIndex) => lineIndex === index ? value : line)));
  }

  function toggleChangingLine(position: number) {
    setChangingLines((current) => current.includes(position)
      ? current.filter((line) => line !== position)
      : [...current, position].sort((left, right) => left - right));
  }

  function cast() {
    if (questionContext?.freezeCoreQuestion() === false) return;
    const values = mode === "line-values" ? manualFromLineValues(lineValues) : modeBValues;
    const evidence: PublicReadingEvidence = mode === "line-values"
      ? { kind: "manual", mode: "line-values" }
      : { kind: "manual", mode: "primary-changing", primaryHexagramNumber: primaryHexagram, changingLines };
    const session = writePublicReadingSession(STORAGE_KEY, { mode, lineValuesBottomUp: values, evidence });
    const reading = buildPublicReading({
      id: session.id,
      createdAt: session.createdAt,
      method: "manual",
      question: session.coreQuestionAtCast ?? session.question ?? question,
      lineValuesBottomUp: values,
      evidence,
    });
    writeCompletedPublicReading(reading);
    clearManualDraft();
    router.push(completedPublicReadingPath(reading.id, zh));
  }

  function selectMode(nextMode: ManualMode, focusIndex?: number) {
    setMode(nextMode);
    setPickerOpen(false);
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

  return (
    <section className="manual-cast-shell" data-manual-cast-tool aria-label={copy.setHexagram}>
      <ol className="manual-progress" aria-label={copy.progressAria}>
        <li data-state="done"><span aria-hidden="true">✓</span><b>{copy.questionStep}</b></li>
        <li className="manual-progress-line" aria-hidden="true" />
        <li data-state="active"><span aria-hidden="true">☯</span><b>{copy.setHexagramStep}</b></li>
        <li className="manual-progress-line" aria-hidden="true" />
        <li data-state="todo"><span aria-hidden="true" /><b>{copy.readingStep}</b></li>
      </ol>

      <div className="manual-question-scroll" data-manual-question>
        <strong>{copy.yourQuestion}</strong>
        <i aria-hidden="true" />
        <p data-clarity-mask="true" data-private-question="true">{question || copy.noQuestion}</p>
      </div>

      <div className="manual-mode-tabs" role="tablist" aria-label={copy.modeSwitchAria}>
        <button
          ref={(node) => { modeTabRefs.current[0] = node; }}
          id="manual-mode-line-values-tab"
          type="button"
          role="tab"
          data-manual-mode="line-values"
          aria-controls="manual-mode-line-values-panel"
          aria-selected={mode === "line-values"}
          tabIndex={mode === "line-values" ? 0 : -1}
          onClick={() => selectMode("line-values")}
          onKeyDown={(event) => handleModeKeyDown(event, 0)}
        >
          <span aria-hidden="true">☷</span>{copy.enterSixLines}
        </button>
        <button
          ref={(node) => { modeTabRefs.current[1] = node; }}
          id="manual-mode-primary-changing-tab"
          type="button"
          role="tab"
          data-manual-mode="primary-changing"
          aria-controls="manual-mode-primary-changing-panel"
          aria-selected={mode === "primary-changing"}
          tabIndex={mode === "primary-changing" ? 0 : -1}
          onClick={() => selectMode("primary-changing")}
          onKeyDown={(event) => handleModeKeyDown(event, 1)}
        >
          <span aria-hidden="true">☰</span>{copy.chooseHexagramMovingLines}
        </button>
      </div>

      {mode === "line-values" ? (
        <ManualSixLinesInput values={lineValues} dictionary={dictionary} onChange={updateLine} />
      ) : (
        <ManualHexagramMovingInput
          dictionary={dictionary}
          primaryHexagram={primaryHexagram}
          changingLines={changingLines}
          lineValues={modeBValues}
          relatingHexagramNumber={modeBResult.relatingHexagramNumber}
          relatingLineValues={relatingLineValues}
          pickerOpen={pickerOpen}
          onPickerOpenChange={setPickerOpen}
          onPrimaryChange={setPrimaryHexagram}
          onToggleChangingLine={toggleChangingLine}
        />
      )}

      <div className="manual-continue-wrap">
        <button type="button" className="manual-continue" onClick={cast} data-manual-continue>
          <span className="manual-continue-taichi" aria-hidden="true">☯</span>
          <strong>{copy.continue}</strong>
          <ArrowRight size={27} strokeWidth={1.6} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
