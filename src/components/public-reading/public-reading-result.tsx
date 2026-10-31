"use client";

import Link from "next/link";
import { SharedReadingSummary, type ReadingChoice } from "./shared-reading-summary";
import { buildResultSigninHref } from "@/lib/commercial-navigation";
import { readReadingEntry, readingEntryKey, readingEntryReturnPath, readingEntryFromCallback, readingUserSignedIn } from "@/lib/reading-entry";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import type { UiDictionary } from "@/i18n/dictionaries/types";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";
import type { HexagramInterpretationBundle } from "@/domain/interpretation/v2/types";
import type { LocalizedReadingContent } from "@/content/mei-hua-yi-shu/types";
import { buildStaticReading } from "@/domain/public-reading/static-reading";
import { saveHistoryRecord } from "@/domain/public-reading/history";
import { readingFingerprint } from "@/domain/public-reading/reading";
import type { PublicReading } from "@/domain/public-reading/types";
import { writeCompletedPublicReading } from "@/lib/completed-public-reading";

function relatingLines(reading: PublicReading): number[] {
  return reading.lineValuesBottomUp.map((value) => value === 6 ? 7 : value === 9 ? 8 : value);
}

function formatCopy(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template);
}

const METHOD_NAMES_ZH: Record<string, string> = {
  "three-coin": "三枚铜钱",
  "yarrow": "蓍草起卦",
  "yarrow-stalks": "蓍草起卦",
  "mei-hua": "梅花易数",
  "mei-hua-yi-shu": "梅花易数",
  "manual": "手动起卦",
};

export function resolveReadingKicker(reading: PublicReading, dictionary: UiDictionary): string {
  if (dictionary.locale !== "zh-Hans") {
    return formatCopy(dictionary.reading.staticKicker, { methodVersion: reading.methodVersion });
  }
  const methodName = METHOD_NAMES_ZH[reading.method] ?? "";
  const baseKicker = dictionary.reading.staticKicker;
  return methodName ? `${methodName} · ${baseKicker}` : baseKicker;
}

export function PublicReadingResult({
  reading,
  onNewReading,
  deepReadingHref,
  onDeepReading,
  dictionary = EN_UI_DICTIONARY,
  localizedContent,
  initialBundles,
  children,
  title = dictionary.reading.title,
  headingLevel = "h3",
  newReadingLabel = dictionary.reading.newReading,
  presentation = "default",
  authenticated,
  showEntrySummary = true,
}: {
  reading: PublicReading;
  onNewReading?: () => void;
  deepReadingHref?: string;
  onDeepReading?: () => void;
  dictionary?: UiDictionary;
  localizedContent?: LocalizedReadingContent;
  initialBundles?: { primary?: HexagramInterpretationBundle; relating?: HexagramInterpretationBundle | null };
  children?: React.ReactNode;
  title?: string;
  headingLevel?: "h1" | "h3";
  newReadingLabel?: string;
  presentation?: "default" | "ritual";
  authenticated?: boolean;
  showEntrySummary?: boolean;
}) {
  const [bundles, setBundles] = useState<{ primary?: HexagramInterpretationBundle; relating?: HexagramInterpretationBundle | null }>(initialBundles ?? {});
  const [resolvedLocalizedContent, setResolvedLocalizedContent] = useState<LocalizedReadingContent | undefined>(localizedContent);
  const [deepEntryError, setDeepEntryError] = useState(false);
  const [contentError, setContentError] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  useEffect(() => {
    setSaveState("idle");
    setDeepEntryError(false);
  }, [reading.id, reading.question]);
  useEffect(() => {
    if (localizedContent) {
      setResolvedLocalizedContent(localizedContent);
      return;
    }
    if (dictionary.locale !== "zh-Hans") {
      setResolvedLocalizedContent(undefined);
      return;
    }
    let active = true;
    void import("@/content/mei-hua-yi-shu/zh-Hans")
      .then(({ ZH_HANS_READING_CONTENT }) => {
        if (active) setResolvedLocalizedContent(ZH_HANS_READING_CONTENT);
      })
      .catch(() => {
        if (active) setContentError(true);
      });
    return () => {
      active = false;
    };
  }, [dictionary.locale, localizedContent]);

  useEffect(() => {
    if (resolvedLocalizedContent) {
      setBundles(initialBundles ?? {});
      return;
    }
    const hasInitialPrimary = initialBundles?.primary?.hexagram.number === reading.primaryHexagram;
    const hasInitialRelating = reading.relatingHexagram === null
      ? initialBundles?.relating === null
      : initialBundles?.relating?.hexagram.number === reading.relatingHexagram;
    if (hasInitialPrimary && hasInitialRelating) {
      setBundles(initialBundles ?? {});
      return;
    }
    let active = true;
    void Promise.all([
      loadHexagramInterpretation(reading.primaryHexagram),
      reading.relatingHexagram === null ? Promise.resolve(null) : loadHexagramInterpretation(reading.relatingHexagram),
    ])
      .then(([primary, relating]) => {
        if (active) setBundles({ primary, relating });
      })
      .catch(() => {
        if (active) setContentError(true);
      });
    return () => {
      active = false;
    };
  }, [initialBundles, reading.primaryHexagram, reading.relatingHexagram, resolvedLocalizedContent]);

  const model = useMemo(
    () => buildStaticReading(reading, bundles, resolvedLocalizedContent),
    [reading, bundles, resolvedLocalizedContent],
  );
  const isChinese = dictionary.locale === "zh-Hans";
  const ritual = presentation === "ritual";
  const ResultHeading = ritual ? "h2" : headingLevel;
  const ResultDetails = ritual ? "div" : React.Fragment;
  const sharedSummary = showEntrySummary && reading.method !== "manual";
  const deepHref = deepReadingHref ?? `${isChinese ? "/zh" : ""}/readings/deep?session=${encodeURIComponent(reading.id)}`;
  const deepUnavailable = reading.method === "manual"
    || (!deepReadingHref && !onDeepReading && reading.evidence.kind === "history" && reading.method !== "three-coin");
  const [entry, setEntry] = useState<ReadingChoice | null>(null);
  const [entryBusy, setEntryBusy] = useState(false);
  const [entryError, setEntryError] = useState("");
  const continueEntry = useCallback((choice: ReadingChoice) => {
    if (choice === "free") {
      setEntry(choice);
      return;
    }
    if (deepUnavailable) {
      setEntryError(isChinese ? "本次起卦缺少深度解读所需的受支持起卦依据。" : "Deep Reading is unavailable because supported casting evidence is missing.");
      return;
    }
    if (onDeepReading) onDeepReading();
    else {
      if (!deepReadingHref) writeCompletedPublicReading(reading);
      window.location.assign(deepHref);
    }
  }, [deepHref, deepReadingHref, deepUnavailable, isChinese, onDeepReading, reading]);
  useEffect(() => {
    let active = true;
    setEntry(null);
    if (!sharedSummary) return;
    async function restore() {
      try {
        const pending = readReadingEntry(window.sessionStorage, reading.id) ?? readingEntryFromCallback(window.location, reading.id);
        if (!pending) return;
        const signedIn = authenticated === true || await readingUserSignedIn();
        if (active && signedIn) {
          window.sessionStorage.setItem(readingEntryKey(reading.id), pending);
          continueEntry(pending);
        }
      } catch {
        if (active) setEntryError(isChinese ? "无法恢复解读选择，请重试。" : "Could not restore your reading choice. Please try again.");
      }
    }
    void restore();
    return () => { active = false; };
  }, [reading.id, authenticated, isChinese, sharedSummary, continueEntry]);
  useEffect(() => {
    if (!entry) return;
    document.getElementById(`reading-${entry}`)?.scrollIntoView({ block: "start" });
  }, [entry]);

  async function chooseEntry(choice: ReadingChoice) {
    setEntryBusy(true);
    setEntryError("");
    try {
      window.sessionStorage.setItem(readingEntryKey(reading.id), choice);
      const signedIn = authenticated === true || await readingUserSignedIn();
      if (!signedIn) {
        window.location.assign(buildResultSigninHref(readingEntryReturnPath(window.location, choice, reading.id), dictionary.locale));
        return;
      }
      continueEntry(choice);
    } catch {
      setEntryError(isChinese ? "无法打开解读，请重试。" : "Could not open your reading. Please try again.");
    } finally {
      setEntryBusy(false);
    }
  }

  const movingPositions = reading.changingLines.join(isChinese ? "、" : ", ");
  const hasChangingLines = reading.changingLines.length > 0;
  const localizedHref = (href: string) => isChinese && href.startsWith("/hexagrams/") ? `/zh${href}` : href;

  if (isChinese && !resolvedLocalizedContent) {
    return (
      <section className="reading-reveal" aria-live="polite" data-public-reading-result data-reading-localization-loading>
        <p className="mystic-kicker" role={contentError ? "alert" : undefined}>{contentError ? "中文解读加载失败，请刷新后重试。" : "正在加载中文卦象解读…"}</p>
      </section>
    );
  }

  function save() {
    try {
      saveHistoryRecord(reading);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function prepareDeepReading(event: React.MouseEvent<HTMLAnchorElement>) {
    if (deepReadingHref) return;
    try {
      writeCompletedPublicReading(reading);
      setDeepEntryError(false);
    } catch {
      event.preventDefault();
      setDeepEntryError(true);
    }
  }
  function deepCta(placement: "top" | "bottom") {
    return <section className="mystic-card-soft mt-5 p-5 sm:p-6" data-deep-reading-cta={placement}>
      <h2 className="font-display text-2xl font-normal">{isChinese ? "想知道这个卦象对你的问题意味着什么？" : "Want to know what this means for your question?"}</h2>
      {deepUnavailable
        ? <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{isChinese ? "本次起卦缺少深度解读所需的受支持起卦依据。你仍可查看并保存免费解读。" : "Deep Reading is unavailable for this cast because supported casting evidence is missing. You can still read and save this Free Reading."}</p>
        : onDeepReading
        ? <button type="button" onClick={onDeepReading} className="mystic-button mt-4">{isChinese ? "获取我的深度解读" : "Get My Deep Reading"}</button>
        : <Link href={deepHref} onClick={prepareDeepReading} className="mystic-button mt-4">{isChinese ? "获取我的深度解读" : "Get My Deep Reading"}</Link>}
    </section>;
  }

  return (
    <section className="reading-reveal" aria-live="polite" aria-labelledby="public-reading-result-title" data-public-reading-result data-reading-fingerprint={readingFingerprint(reading)}>
      {sharedSummary ? <SharedReadingSummary reading={reading} model={model} zh={isChinese} onChoose={(choice) => { void chooseEntry(choice); }} busy={entryBusy} error={entryError} /> : null}
      <div id="reading-free" className={sharedSummary ? "shared-reading-content" : undefined} hidden={sharedSummary && !entry} style={sharedSummary && !entry ? { display: "none" } : undefined} data-reading-open={sharedSummary ? entry ?? "none" : "free"}>
      <ResultDetails {...(ritual ? { className: "mx-auto max-w-5xl px-4 py-8" } : {})}>
      <div className="text-center">
        <p className="mystic-kicker">{resolveReadingKicker(reading, dictionary)}</p>
        <ResultHeading id="public-reading-result-title" className="mt-2 font-display text-3xl font-normal tracking-[-0.03em] sm:text-4xl">{title}</ResultHeading>
        {reading.question ? <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-2)]" data-clarity-mask="true" data-private-question="true"><strong>{dictionary.reading.questionLabel} </strong>{reading.question}</p> : null}
      </div>
      {deepCta("top")}
      {deepEntryError ? <p role="alert" className="mt-4 text-sm">{isChinese ? "无法保存本次起卦以继续深度解读，请检查浏览器存储后重试。" : "Could not save this cast to continue to Deep Reading. Check browser storage and retry."}</p> : null}
      {contentError ? <p role="alert" className="mt-4 text-sm">{isChinese ? "部分解读加载失败，请刷新后重试。" : "Some reading content could not load. Please refresh to retry."}</p> : null}
      <section className="mystic-card-soft mt-5 p-5 sm:p-6" data-overall-reading>
        <h2 className="font-display text-2xl font-normal">{isChinese ? "整体解读" : "Overall Reading"}</h2>
        <p className="reading-copy">{model.overallReading}</p>
        <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]" data-free-cast-boundary>{isChinese ? "这一层免费解读说明卦象本身，不会把它套用到你的具体处境。" : "This free layer explains the cast itself. It has not been interpreted against your specific situation."}</p>
      </section>
      <article id="general-cast-interpretation" className="reading-card-a mt-5" data-primary-card>
        <p className="mystic-kicker">{dictionary.reading.primary}</p>
        <div className="reading-number mt-5">{model.primary.number}</div>
        <h2 className="reading-title">{model.primary.englishName}</h2>
        <p className="reading-cn mt-2">{isChinese ? model.primary.chineseName : `${model.primary.chineseName} · ${model.primary.pinyin}`}</p>
        <HexagramLines lines={[...reading.lineValuesBottomUp]} size="lg" locale={dictionary.locale} className="mt-8 max-w-sm" />
        <p className="reading-theme">{model.primary.theme}</p>
        <p className="reading-copy">{model.primary.shortMeaning}</p>
        <Link href={localizedHref(model.primary.href)} className="mt-5 inline-flex text-sm font-semibold text-[var(--cyan)] hover:underline">{formatCopy(dictionary.reading.linkPrimary, { number: model.primary.number })}</Link>
      </article>
      <section className="mt-8 grid gap-4" data-changing-lines aria-labelledby="active-lines-title">
        <h2 id="active-lines-title" className="font-display text-2xl font-normal">{dictionary.reading.changingLines}{hasChangingLines ? `: ${movingPositions}` : ""}</h2>
        {model.activeLines.length ? model.activeLines.map((line) => <article key={line.position} id={`result-line-${line.position}`} className="mystic-card-soft p-5 sm:p-6" data-active-line={line.position}>
          <h3 className="font-display text-xl font-normal text-[var(--gold-2)]">{isChinese ? `第${line.position}爻` : `Line ${line.position}`} · {line.lineValue}</h3>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]" data-line-core-meaning>{line.coreMeaning}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]" data-line-change-meaning>{line.changeMeaning}</p>
        </article>) : <div className="mystic-card-soft p-5"><p>{dictionary.reading.noChangingLines}</p><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">{dictionary.reading.noChangingLinesExplanation}</p></div>}
      </section>
      {model.relating ? <article className="reading-card-a mt-5" data-relating-card>
        <p className="mystic-kicker">{dictionary.reading.relating}</p>
        <div className="reading-number mt-5">{model.relating.number}</div>
        <h2 className="reading-title">{model.relating.englishName}</h2>
        <p className="reading-cn mt-2">{isChinese ? model.relating.chineseName : `${model.relating.chineseName} · ${model.relating.pinyin}`}</p>
        <HexagramLines lines={relatingLines(reading)} size="lg" locale={dictionary.locale} className="mt-8 max-w-sm" />
        <p className="reading-theme">{model.relating.theme}</p>
        <p className="reading-copy">{model.relating.shortMeaning}</p>
        <Link href={localizedHref(model.relating.href)} className="mt-5 inline-flex text-sm font-semibold text-[var(--cyan)] hover:underline">{dictionary.reading.linkRelating}</Link>
      </article> : <article className="reading-card-a mt-5" data-no-relating-card>
        <h2 className="font-display text-2xl font-normal">{dictionary.reading.noRelating}</h2>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{dictionary.reading.noRelatingExplanation}</p>
      </article>}
      <section className="mystic-card-soft mt-5 p-5 sm:p-6" data-reading-transition>
        <h2 className="font-display text-2xl font-normal">{isChinese ? "变化路径" : "Transition"}</h2>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{model.primary.number} · {model.primary.englishName} → {hasChangingLines ? `${dictionary.reading.changingLines}: ${movingPositions}` : dictionary.reading.noChangingLines} → {model.relating ? `${model.relating.number} · ${model.relating.englishName}` : dictionary.reading.noRelating}</p>
        <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">{model.transition}</p>
      </section>
      {deepCta("bottom")}
      {children}
      <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-white/[0.08] pt-6">
        <button type="button" onClick={save} className="mystic-button" data-save-reading>{saveState === "saved" ? dictionary.reading.saved : dictionary.reading.save}</button>
        {onNewReading ? <button type="button" onClick={onNewReading} className="mystic-button-secondary">{newReadingLabel}</button> : null}
        <Link href={isChinese ? "/zh/history" : "/history"} className="mystic-button-secondary">{dictionary.reading.history}</Link>
        {saveState === "error" ? <span role="status" className="text-sm text-[var(--danger)]">{dictionary.reading.saveError}</span> : null}
      </div>
      <p className="mt-7 border-t border-white/[0.08] pt-5 text-xs leading-6 text-[var(--ink-3)]">{dictionary.reading.safety}</p>
      </ResultDetails>
      </div>
    </section>
  );
}
