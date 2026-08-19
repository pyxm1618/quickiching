"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";
import type { HexagramInterpretationBundle } from "@/domain/interpretation/v2/types";
import { buildStaticReading } from "@/domain/public-reading/static-reading";
import { saveHistoryRecord } from "@/domain/public-reading/history";
import { readingFingerprint } from "@/domain/public-reading/reading";
import type { PublicReading } from "@/domain/public-reading/types";
import { PersonalizedInterpretation } from "./personalized-interpretation";

function relatingLines(reading: PublicReading): number[] {
  return reading.lineValuesBottomUp.map((value) => value === 6 ? 7 : value === 9 ? 8 : value);
}

export function PublicReadingResult({
  reading,
  onNewReading,
}: {
  reading: PublicReading;
  onNewReading?: () => void;
}) {
  const [bundles, setBundles] = useState<{ primary?: HexagramInterpretationBundle; relating?: HexagramInterpretationBundle | null }>({});
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  useEffect(() => {
    setSaveState("idle");
  }, [reading.id, reading.question]);
  useEffect(() => {
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
  }, [reading.primaryHexagram, reading.relatingHexagram]);

  const model = useMemo(() => buildStaticReading(reading, bundles), [reading, bundles]);
  const movingLabel = reading.changingLines.length > 0 ? reading.changingLines.join(", ") : "None";

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
        <p className="mystic-kicker">Static reading · {reading.methodVersion}</p>
        <h3 id="public-reading-result-title" className="mt-2 font-display text-3xl font-normal tracking-[-0.03em] sm:text-4xl">Your I Ching reading</h3>
        {reading.question ? (
          <p className="mx-auto mt-4 max-w-2xl rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-left text-sm leading-7 text-[var(--ink-2)]" data-clarity-mask="true" data-private-question="true">
            <span className="font-semibold text-[var(--gold-2)]">Your question · </span>{reading.question}
          </p>
        ) : null}
      </div>

      <div className="reading-path">
        <article className="reading-card-a" data-primary-card>
          <p className="mystic-kicker">Primary Hexagram</p>
          <div className="reading-number mt-5">{model.primary.number}</div>
          <h4 className="reading-title">{model.primary.englishName}</h4>
          <p className="reading-cn mt-2">{model.primary.chineseName} · {model.primary.pinyin}</p>
          <HexagramLines lines={[...reading.lineValuesBottomUp]} size="lg" showLabels className="mt-8 max-w-sm" />
          <p className="reading-theme">{model.primary.theme}</p>
          <p className="reading-copy">{model.primary.coreMeaning}</p>
          <Link href={model.primary.href} className="mt-5 inline-flex text-sm font-semibold text-[var(--cyan)] hover:underline">Read Hexagram {model.primary.number} in full →</Link>
          <p className="mt-5 border-t border-white/[0.08] pt-4 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--gold-2)]">Judgment · </strong>{model.primary.judgment}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--gold-2)]">Image · </strong>{model.primary.image}</p>
        </article>

        <div className="change-bridge" aria-label={`Changing lines: ${movingLabel}`}>
          <div className="change-orb">{movingLabel}</div>
          <small>Changing lines</small>
        </div>

        {model.relating ? (
          <article className="reading-card-a" data-relating-card>
            <p className="mystic-kicker">Relating Hexagram</p>
            <div className="reading-number mt-5">{model.relating.number}</div>
            <h4 className="reading-title">{model.relating.englishName}</h4>
            <p className="reading-cn mt-2">{model.relating.chineseName} · {model.relating.pinyin}</p>
            <HexagramLines lines={relatingLines(reading)} size="lg" showLabels className="mt-8 max-w-sm" />
            <p className="reading-theme">{model.relating.theme}</p>
            <p className="reading-copy">{model.relating.coreMeaning}</p>
            <Link href={model.relating.href} className="mt-5 inline-flex text-sm font-semibold text-[var(--cyan)] hover:underline">Open relating hexagram →</Link>
          </article>
        ) : null}
      </div>

      <div className="change-detail">
        <strong className="text-white">Changing Lines: {movingLabel}</strong>
        <span className="mx-2 text-[var(--gold)]">◇</span>
        {model.changing}
      </div>

      {model.activeLines.length > 0 ? (
        <section className="mt-8 grid gap-4" aria-labelledby="active-lines-title">
          <div><p className="mystic-kicker">Understand the movement</p><h4 id="active-lines-title" className="mt-2 font-display text-2xl font-normal">Active line interpretation</h4></div>
          {model.activeLines.map((line) => (
            <article key={line.position} id={`result-line-${line.position}`} className="mystic-card-soft p-5 sm:p-6" data-active-line={line.position}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h5 className="font-display text-xl font-normal text-[var(--gold-2)]">Line {line.position} · {line.lineType}</h5>
                <span className="font-mono text-xs text-[var(--cyan)]">{line.changeDirection} · {line.lineValue}</span>
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">{line.meaning}</p>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--gold-2)]">Caution · </strong>{line.caution}</p>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--gold-2)]">Reflection · </strong>{line.reflection}</p>
              <Link href={line.href} className="mt-4 inline-flex text-xs font-semibold text-[var(--cyan)] hover:underline">Read the full line at Hexagram {model.primary.number} →</Link>
            </article>
          ))}
        </section>
      ) : null}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section className="mystic-card-soft p-5 sm:p-6" aria-labelledby="reading-core-title">
          <p className="mystic-kicker">Core meaning</p>
          <h4 id="reading-core-title" className="mt-2 font-display text-2xl font-normal">What to hold</h4>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink-2)]">{model.supports.map((item) => <li key={item} className="border-l border-[var(--gold)]/40 pl-4">{item}</li>)}</ul>
        </section>
        <section className="mystic-card-soft p-5 sm:p-6" aria-labelledby="reading-cautions-title">
          <p className="mystic-kicker">Supports & cautions</p>
          <h4 id="reading-cautions-title" className="mt-2 font-display text-2xl font-normal">Keep it grounded</h4>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink-2)]">{model.cautions.map((item) => <li key={item} className="border-l border-[var(--cyan)]/40 pl-4">{item}</li>)}</ul>
        </section>
      </div>

      <section className="mystic-card-soft mt-5 p-5 sm:p-6" aria-labelledby="reading-synthesis-title">
        <p className="mystic-kicker">Synthesis</p>
        <h4 id="reading-synthesis-title" className="mt-2 font-display text-2xl font-normal">A way to return to the question</h4>
        <dl className="mt-5 grid gap-4 text-sm leading-7 text-[var(--ink-2)] sm:grid-cols-2">
          <div><dt className="font-semibold text-[var(--gold-2)]">Situation</dt><dd className="mt-1">{model.synthesis.situation}</dd></div>
          <div><dt className="font-semibold text-[var(--gold-2)]">Where change is happening</dt><dd className="mt-1">{model.synthesis.whereChangeIsHappening}</dd></div>
          <div><dt className="font-semibold text-[var(--gold-2)]">Direction</dt><dd className="mt-1">{model.synthesis.directionOfChange}</dd></div>
          <div><dt className="font-semibold text-[var(--gold-2)]">Bottom line</dt><dd className="mt-1">{model.synthesis.bottomLine}</dd></div>
        </dl>
      </section>

      <section className="mystic-card-soft mt-5 p-5 sm:p-6" aria-labelledby="reading-reflection-title">
        <p className="mystic-kicker">Reflect</p>
        <h4 id="reading-reflection-title" className="mt-2 font-display text-2xl font-normal">Three questions to carry forward</h4>
        <ol className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-2)] sm:grid-cols-3">{model.reflections.map((item, index) => <li key={item} className="rounded-2xl border border-white/[0.08] p-4"><span className="font-mono text-xs text-[var(--gold-2)]">0{index + 1}</span><p className="mt-2">{item}</p></li>)}</ol>
      </section>

      <PersonalizedInterpretation reading={reading} />

      <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-white/[0.08] pt-6">
        <button type="button" onClick={save} className="mystic-button" data-save-reading>{saveState === "saved" ? "Saved in this browser" : "Save reading"}</button>
        {onNewReading ? <button type="button" onClick={onNewReading} className="mystic-button-secondary">New reading</button> : null}
        <Link href="/history/" className="mystic-button-secondary">View history</Link>
        {reading.method === "three-coin" ? <Link href="/readings/three-coin/result" className="mystic-button-secondary">Reveal Your Reading</Link> : null}
        {saveState === "error" ? <span role="status" className="text-sm text-[var(--danger)]">Browser history is unavailable or full.</span> : null}
      </div>

      <p className="mt-7 border-t border-white/[0.08] pt-5 text-xs leading-6 text-[var(--ink-3)]">This is a symbolic framework for reflection, not a deterministic prediction and not medical, legal, financial, or safety advice. Keep real-world evidence and your own judgment in the decision.</p>
    </section>
  );
}
