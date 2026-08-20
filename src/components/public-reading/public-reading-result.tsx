"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { PersonalizedInterpretation } from "./personalized-interpretation";

function relatingLines(reading: PublicReading): number[] {
  return reading.lineValuesBottomUp.map((value) => value === 6 ? 7 : value === 9 ? 8 : value);
}

function formatCopy(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template);
}

export function PublicReadingResult({
  reading,
  onNewReading,
  dictionary = EN_UI_DICTIONARY,
  localizedContent,
}: {
  reading: PublicReading;
  onNewReading?: () => void;
  dictionary?: UiDictionary;
  localizedContent?: LocalizedReadingContent;
}) {
  const [bundles, setBundles] = useState<{ primary?: HexagramInterpretationBundle; relating?: HexagramInterpretationBundle | null }>({});
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  useEffect(() => {
    setSaveState("idle");
  }, [reading.id, reading.question]);
  useEffect(() => {
    if (localizedContent) {
      setBundles({});
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
        // The basic static model remains complete if a code-split interpretation bundle cannot load.
      });
    return () => {
      active = false;
    };
  }, [localizedContent, reading.primaryHexagram, reading.relatingHexagram]);

  const model = useMemo(() => buildStaticReading(reading, bundles, localizedContent), [reading, bundles, localizedContent]);
  const movingLabel = reading.changingLines.length > 0 ? reading.changingLines.join(", ") : dictionary.locale === "zh-Hans" ? "无" : "None";

  function save() {
    try {
      saveHistoryRecord(reading);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <section className="reading-reveal" aria-live="polite" aria-labelledby="public-reading-result-title" data-public-reading-result data-reading-fingerprint={readingFingerprint(reading)}>
      <div className="text-center">
        <p className="mystic-kicker">{formatCopy(dictionary.reading.staticKicker, { methodVersion: reading.methodVersion })}</p>
        <h3 id="public-reading-result-title" className="mt-2 font-display text-3xl font-normal tracking-[-0.03em] sm:text-4xl">{dictionary.reading.title}</h3>
        {reading.question ? (
          <p className="mx-auto mt-4 max-w-2xl rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-left text-sm leading-7 text-[var(--ink-2)]" data-clarity-mask="true" data-private-question="true">
            <span className="font-semibold text-[var(--gold-2)]">{dictionary.reading.questionLabel} </span>{reading.question}
          </p>
        ) : null}
      </div>

      <div className="reading-path">
        <article className="reading-card-a" data-primary-card>
          <p className="mystic-kicker">{dictionary.reading.primary}</p>
          <div className="reading-number mt-5">{model.primary.number}</div>
          <h4 className="reading-title">{model.primary.englishName}</h4>
          <p className="reading-cn mt-2">{model.primary.chineseName} · {model.primary.pinyin}</p>
          <HexagramLines lines={[...reading.lineValuesBottomUp]} size="lg" showLabels className="mt-8 max-w-sm" />
          <p className="mystic-kicker mt-8">{dictionary.reading.originalExplanation}</p>
          <p className="reading-theme">{model.primary.theme}</p>
          <p className="reading-copy">{model.primary.coreMeaning}</p>
          <Link href={model.primary.href} className="mt-5 inline-flex text-sm font-semibold text-[var(--cyan)] hover:underline">{formatCopy(dictionary.reading.linkPrimary, { number: model.primary.number })}</Link>
          <p className="mt-5 border-t border-white/[0.08] pt-4 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--gold-2)]">{dictionary.reading.judgment} · </strong>{model.primary.judgment}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--gold-2)]">{dictionary.reading.image} · </strong>{model.primary.image}</p>
          <a href={model.primary.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-[var(--cyan)] hover:underline">{dictionary.reading.source} · oldid {model.primary.sourceRevision}</a>
        </article>

        <div className="change-bridge" aria-label={`${dictionary.reading.changingLines}: ${movingLabel}`}>
          <div className="change-orb">{movingLabel}</div>
          <small>{dictionary.reading.changingLines}</small>
        </div>

        {model.relating ? (
          <article className="reading-card-a" data-relating-card>
            <p className="mystic-kicker">{dictionary.reading.relating}</p>
            <div className="reading-number mt-5">{model.relating.number}</div>
            <h4 className="reading-title">{model.relating.englishName}</h4>
            <p className="reading-cn mt-2">{model.relating.chineseName} · {model.relating.pinyin}</p>
            <HexagramLines lines={relatingLines(reading)} size="lg" showLabels className="mt-8 max-w-sm" />
            <p className="mystic-kicker mt-8">{dictionary.reading.originalExplanation}</p>
            <p className="reading-theme">{model.relating.theme}</p>
            <p className="reading-copy">{model.relating.coreMeaning}</p>
            <Link href={model.relating.href} className="mt-5 inline-flex text-sm font-semibold text-[var(--cyan)] hover:underline">{dictionary.reading.linkRelating}</Link>
          </article>
        ) : null}
      </div>

      <div className="change-detail">
        <strong className="text-white">{dictionary.reading.changingLines}: {movingLabel}</strong>
        <span className="mx-2 text-[var(--gold)]">◇</span>
        {model.changing}
      </div>

      {model.activeLines.length > 0 ? (
        <section className="mt-8 grid gap-4" aria-labelledby="active-lines-title">
          <div><p className="mystic-kicker">{dictionary.reading.understandMovement}</p><h4 id="active-lines-title" className="mt-2 font-display text-2xl font-normal">{dictionary.reading.activeInterpretation}</h4></div>
          {model.activeLines.map((line) => (
            <article key={line.position} id={`result-line-${line.position}`} className="mystic-card-soft p-5 sm:p-6" data-active-line={line.position}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h5 className="font-display text-xl font-normal text-[var(--gold-2)]">{dictionary.locale === "zh-Hans" ? `${dictionary.reading.line}${line.position}爻` : `${dictionary.reading.line} ${line.position}`} · {line.lineType}</h5>
                <span className="font-mono text-xs text-[var(--cyan)]">{line.changeDirection} · {line.lineValue}</span>
              </div>
              <div className="mt-4 rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/[0.05] p-4">
                <p className="mystic-kicker">{dictionary.reading.classicalLine}</p>
                <p className="mt-2 text-base leading-7 text-[var(--ink)]"><strong className="text-[var(--gold-2)]">{line.classicalLine.label}：</strong>{line.classicalLine.text}</p>
                <a href={line.classicalLine.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-[var(--cyan)] hover:underline">{dictionary.reading.source} · oldid {line.classicalLine.sourceRevision}</a>
              </div>
              <div className="mt-4 rounded-2xl border border-white/[0.08] p-4">
                <p className="mystic-kicker">{dictionary.reading.originalExplanation}</p>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">{line.originalExplanation}</p>
              </div>
              <div className="mt-4 rounded-2xl border border-[var(--cyan)]/20 p-4">
                <p className="mystic-kicker">{dictionary.reading.positionHint}</p>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">{line.positionHint}</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--gold-2)]">{dictionary.reading.caution} </strong>{line.caution}</p>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--gold-2)]">{dictionary.reading.reflection} </strong>{line.reflection}</p>
              <Link href={line.href} className="mt-4 inline-flex text-xs font-semibold text-[var(--cyan)] hover:underline">{formatCopy(dictionary.reading.readFullLine, { number: model.primary.number })}</Link>
            </article>
          ))}
        </section>
      ) : null}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section className="mystic-card-soft p-5 sm:p-6" aria-labelledby="reading-core-title">
          <p className="mystic-kicker">{dictionary.reading.coreMeaning}</p>
          <h4 id="reading-core-title" className="mt-2 font-display text-2xl font-normal">{dictionary.reading.whatToHold}</h4>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink-2)]">{model.supports.map((item) => <li key={item} className="border-l border-[var(--gold)]/40 pl-4">{item}</li>)}</ul>
        </section>
        <section className="mystic-card-soft p-5 sm:p-6" aria-labelledby="reading-cautions-title">
          <p className="mystic-kicker">{dictionary.reading.supportsCautions}</p>
          <h4 id="reading-cautions-title" className="mt-2 font-display text-2xl font-normal">{dictionary.reading.keepGrounded}</h4>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink-2)]">{model.cautions.map((item) => <li key={item} className="border-l border-[var(--cyan)]/40 pl-4">{item}</li>)}</ul>
        </section>
      </div>

      <section className="mystic-card-soft mt-5 p-5 sm:p-6" aria-labelledby="reading-synthesis-title">
        <p className="mystic-kicker">{dictionary.reading.synthesis}</p>
        <h4 id="reading-synthesis-title" className="mt-2 font-display text-2xl font-normal">{dictionary.reading.returnQuestion}</h4>
        <dl className="mt-5 grid gap-4 text-sm leading-7 text-[var(--ink-2)] sm:grid-cols-2">
          <div><dt className="font-semibold text-[var(--gold-2)]">{dictionary.reading.situation}</dt><dd className="mt-1">{model.synthesis.situation}</dd></div>
          <div><dt className="font-semibold text-[var(--gold-2)]">{dictionary.reading.whereChange}</dt><dd className="mt-1">{model.synthesis.whereChangeIsHappening}</dd></div>
          <div><dt className="font-semibold text-[var(--gold-2)]">{dictionary.reading.direction}</dt><dd className="mt-1">{model.synthesis.directionOfChange}</dd></div>
          <div><dt className="font-semibold text-[var(--gold-2)]">{dictionary.reading.bottomLine}</dt><dd className="mt-1">{model.synthesis.bottomLine}</dd></div>
        </dl>
      </section>

      <section className="mystic-card-soft mt-5 p-5 sm:p-6" aria-labelledby="reading-reflection-title">
        <p className="mystic-kicker">{dictionary.reading.reflect}</p>
        <h4 id="reading-reflection-title" className="mt-2 font-display text-2xl font-normal">{dictionary.reading.threeQuestions}</h4>
        <ol className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-2)] sm:grid-cols-3">{model.reflections.map((item, index) => <li key={item} className="rounded-2xl border border-white/[0.08] p-4"><span className="font-mono text-xs text-[var(--gold-2)]">0{index + 1}</span><p className="mt-2">{item}</p></li>)}</ol>
      </section>

      {dictionary.locale === "en" ? <PersonalizedInterpretation reading={reading} /> : null}

      <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-white/[0.08] pt-6">
        {dictionary.locale === "en" ? <button type="button" onClick={save} className="mystic-button" data-save-reading>{saveState === "saved" ? dictionary.reading.saved : dictionary.reading.save}</button> : null}
        {onNewReading ? <button type="button" onClick={onNewReading} className="mystic-button-secondary">{dictionary.reading.newReading}</button> : null}
        {dictionary.locale === "en" ? <Link href="/history" className="mystic-button-secondary">{dictionary.reading.history}</Link> : null}
        {dictionary.locale === "en" && reading.method === "three-coin" ? <Link href="/readings/three-coin/result" className="mystic-button-secondary">Reveal Your Reading</Link> : null}
        {dictionary.locale === "en" && saveState === "error" ? <span role="status" className="text-sm text-[var(--danger)]">{dictionary.reading.saveError}</span> : null}
      </div>

      <p className="mt-7 border-t border-white/[0.08] pt-5 text-xs leading-6 text-[var(--ink-3)]">{dictionary.reading.safety}</p>
    </section>
  );
}
