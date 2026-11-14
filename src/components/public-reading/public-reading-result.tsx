"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import type { UiDictionary } from "@/i18n/dictionaries/types";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";
import type { HexagramInterpretationBundle } from "@/domain/interpretation/v2/types";
import type { LocalizedReadingContent } from "@/content/mei-hua-yi-shu/types";
import { buildStaticReading } from "@/domain/public-reading/static-reading";
import { readingFingerprint } from "@/domain/public-reading/reading";
import type { PublicReading } from "@/domain/public-reading/types";
import { writePendingCompletedReading } from "@/lib/pending-completed-reading";
import { FreeReadingRitualView } from "./free-reading-ritual-view";

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
  newReadingLabel = dictionary.reading.newReading,
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
  newReadingLabel?: string;
}) {
  const [bundles, setBundles] = useState<{ primary?: HexagramInterpretationBundle; relating?: HexagramInterpretationBundle | null }>(initialBundles ?? {});
  const [resolvedLocalizedContent, setResolvedLocalizedContent] = useState<LocalizedReadingContent | undefined>(localizedContent);
  const [deepEntryError, setDeepEntryError] = useState(false);
  const [contentError, setContentError] = useState(false);
  useEffect(() => {
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

  if (isChinese && !resolvedLocalizedContent) {
    return (
      <section aria-live="polite" data-public-reading-result data-reading-localization-loading>
        <p className="mystic-kicker" role={contentError ? "alert" : undefined}>{contentError ? "中文解读加载失败，请刷新后重试。" : "正在加载中文卦象解读…"}</p>
      </section>
    );
  }


  const deepHref = deepReadingHref ?? `${isChinese ? "/zh" : ""}/readings/deep?session=${encodeURIComponent(reading.id)}`;
  function prepareDeepReading(event: React.MouseEvent<HTMLAnchorElement>) {
    if (deepReadingHref) return;
    try {
      writePendingCompletedReading(reading);
      setDeepEntryError(false);
    } catch {
      event.preventDefault();
      setDeepEntryError(true);
    }
  }
  const deepAction = onDeepReading
    ? <button type="button" onClick={onDeepReading} className="mystic-button">{isChinese ? "获取我的深度解读" : "Get My Deep Reading"}</button>
    : <Link href={deepHref} onClick={prepareDeepReading} className="mystic-button">{isChinese ? "获取我的深度解读" : "Get My Deep Reading"}</Link>;


  return (
    <section aria-live="polite" data-public-reading-result data-reading-fingerprint={readingFingerprint(reading)}>
      <h1 id="public-reading-result-title" className="sr-only">{title}</h1>
      <div>
        <FreeReadingRitualView
          reading={reading}
          model={model}
          dictionary={dictionary}
          deepAction={deepAction}
          deepUnavailableMessage={null}
          deepEntryError={deepEntryError
            ? (isChinese ? "无法保存本次起卦以继续深度解读，请检查浏览器存储后重试。" : "Could not save this cast to continue to Deep Reading. Check browser storage and retry.")
            : null}
          contentError={contentError
            ? (isChinese ? "部分解读加载失败，请刷新后重试。" : "Some reading content could not load. Please refresh to retry.")
            : null}
        />
        {children}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 pb-8 pt-5" data-free-reading-actions>
          {onNewReading ? <button type="button" onClick={onNewReading} className="mystic-button-secondary">{newReadingLabel}</button> : null}
        </div>
      </div>
    </section>
  );
}
