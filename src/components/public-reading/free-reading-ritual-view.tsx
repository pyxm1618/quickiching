"use client";

import Link from "next/link";
import React from "react";
import { Lightbulb, ListChecks, UserRound } from "lucide-react";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import type { UiDictionary } from "@/i18n/dictionaries/types";
import type { PublicStaticReading } from "@/domain/public-reading/static-reading";
import type { PublicReading } from "@/domain/public-reading/types";
import styles from "./free-reading-ritual-view.module.css";

const A = {
  hero: ["/free-reading/runtime/hero-desktop.webp", "/free-reading/runtime/hero-mobile.jpg", "image/webp"],
  overall: ["/free-reading/runtime/overall-desktop.avif", "/free-reading/runtime/overall-mobile.avif", "image/avif"],
  primary: ["/free-reading/runtime/primary-desktop.avif", "/free-reading/runtime/primary-mobile.avif", "image/avif"],
  relating: ["/free-reading/runtime/relating-desktop.avif", "/free-reading/runtime/relating-mobile.avif", "image/avif"],
  changing: ["/free-reading/runtime/changing-desktop.avif", "/free-reading/runtime/changing-mobile.avif", "image/avif"],
  transition: ["/free-reading/runtime/transition-desktop.avif", "/free-reading/runtime/transition-mobile.avif", "image/avif"],
  bottom: ["/free-reading/runtime/bottom-desktop.avif", "/free-reading/runtime/bottom-mobile.avif", "image/avif"],
} as const;

function relatingLines(reading: PublicReading): number[] {
  return reading.lineValuesBottomUp.map((v) => v === 6 ? 7 : v === 9 ? 8 : v);
}

function Art({
  asset, className, eager = false,
}: {
  asset: readonly [string, string, string];
  className: string;
  eager?: boolean;
}) {
  return (
    <picture className={className}>
      <source media="(max-width: 700px)" srcSet={asset[1]} />
      <img
        src={asset[0]}
        alt=""
        width={1600}
        height={600}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "low"}
        decoding="async"
      />
    </picture>
  );
}

function Benefits({ zh }: { zh: boolean }) {
  const items = zh
    ? [
        [UserRound, "围绕你的具体问题"],
        [ListChecks, "清晰建议与下一步"],
        [Lightbulb, "更深层洞察与背景"],
      ] as const
    : [
        [UserRound, "Personalized to your question"],
        [ListChecks, "Clear guidance and next steps"],
        [Lightbulb, "Deeper insights and context"],
      ] as const;
  return (
    <div className={styles.benefits}>
      {items.map(([Icon, copy]) => (
        <div className={styles.benefit} key={copy}>
          <span><Icon aria-hidden="true" /></span>
          <p>{copy}</p>
        </div>
      ))}
    </div>
  );
}

function Cta({
  placement, zh, action, unavailable,
}: {
  placement: "top" | "bottom";
  zh: boolean;
  action: React.ReactNode;
  unavailable?: string | null;
}) {
  const top = placement === "top";
  return (
    <section className={top ? styles.hero : styles.bottom} data-deep-reading-cta={placement}>
      <Art asset={top ? A.hero : A.bottom} className={styles.art} eager={top} />
      <div className={styles.ctaShade} aria-hidden="true" />
      <div className={top ? styles.heroCopy : styles.bottomCopy}>
        <h2>
          {top
            ? (zh ? "想知道这个卦象对你的问题意味着什么？" : "Want to know what this means for your question?")
            : (zh
              ? <>你已经看懂卦象。<br />现在看看它对你的问题意味着什么。</>
              : <>You understand the cast.<br />Now see what it means for your question.</>)}
        </h2>
        <p>
          {top
            ? (zh ? "获取个性化 AI 解读，把这个卦象放回你的具体问题中理解。" : "Get a personalized AI reading that interprets this hexagram in the context of your specific question.")
            : (zh ? "获取围绕你具体处境的个性化 AI 解读，包括建议、下一步和更深入的洞察。" : "Get a personalized AI reading with guidance, next steps, and deeper insights for your specific situation.")}
        </p>
        <div className={styles.ctaAction}>{unavailable ? <p className={styles.unavailable}>{unavailable}</p> : action}</div>
      </div>
      <Benefits zh={zh} />
    </section>
  );
}

function HexCard({
  kind, reading, model, zh,
}: {
  kind: "primary" | "relating";
  reading: PublicReading;
  model: PublicStaticReading;
  zh: boolean;
}) {
  const primary = kind === "primary";
  const x = primary ? model.primary : model.relating;
  if (!x) return null;
  const lines = primary ? [...reading.lineValuesBottomUp] : relatingLines(reading);
  return (
    <article className={primary ? styles.primaryCard : styles.relatingCard} {...(primary ? {"data-primary-card": true} : {"data-relating-card": true})}>
      <Art asset={primary ? A.primary : A.relating} className={styles.cardArt} />
      <div className={styles.cardLabel}>{zh ? (primary ? "本卦" : "之卦") : (primary ? "Primary Hexagram" : "Relating Hexagram")}</div>
      <div className={styles.cardContent}>
        <header>
          <h3>{x.englishName}</h3>
          <p>{zh ? `第 ${x.number} 卦` : `Hexagram ${x.number} · ${x.pinyin}`}</p>
        </header>
        <div className={styles.cardBody}>
          <div className={styles.hexFigure}>
            <div className={styles.hexLines}><HexagramLines lines={lines} size="lg" locale={zh ? "zh-Hans" : "en"} /></div>
            <strong className={styles.chineseName}>{x.chineseName}</strong>
          </div>
          <div className={styles.meaning}>
            <span>{zh ? "核心主题" : "Core Theme"}</span>
            <strong>{x.theme}</strong>
            <p>{x.shortMeaning}</p>
            <Link href={zh && x.href.startsWith("/hexagrams/") ? `/zh${x.href}` : x.href}>{zh ? "查看完整卦象" : "View Full Hexagram"} →</Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function StillCard({ zh, copy }: { zh: boolean; copy: string }) {
  return (
    <article className={styles.relatingCard} data-no-relating-card>
      <Art asset={A.relating} className={styles.cardArt} />
      <div className={styles.cardLabel}>{zh ? "静卦" : "Still Hexagram"}</div>
      <div className={styles.stillContent}>
        <h3>{zh ? "没有之卦" : "No Relating Hexagram"}</h3>
        <p>{copy}</p>
      </div>
    </article>
  );
}

export function FreeReadingRitualView({
  reading, model, dictionary, deepAction, deepUnavailableMessage, deepEntryError, contentError,
}: {
  reading: PublicReading;
  model: PublicStaticReading;
  dictionary: UiDictionary;
  deepAction: React.ReactNode;
  deepUnavailableMessage?: string | null;
  deepEntryError?: string | null;
  contentError?: string | null;
}) {
  const zh = dictionary.locale === "zh-Hans";
  const moving = reading.changingLines;
  const linesLabel = moving.join(zh ? "、" : ", ");
  const relating = model.relating;
  const transformedLines = relatingLines(reading);
  return (
    <main className={styles.page} data-free-reading-ritual data-reading-method={reading.method}>
      <link rel="preload" as="image" href={A.hero[1]} media="(max-width:700px)" fetchPriority="high" />
      <link rel="preload" as="image" href={A.hero[0]} type="image/webp" media="(min-width:701px)" fetchPriority="high" />
      <Cta placement="top" zh={zh} action={deepAction} unavailable={deepUnavailableMessage} />

      {(deepEntryError || contentError) ? (
        <div className={styles.alerts} role="status">
          {deepEntryError ? <p>{deepEntryError}</p> : null}
          {contentError ? <p>{contentError}</p> : null}
        </div>
      ) : null}

      <section className={styles.overall} data-overall-reading>
        <Art asset={A.overall} className={styles.art} />
        <div className={styles.overallContent}>
          <h2>{zh ? "整体解读" : "Overall Reading"}</h2>
          <p>{model.overallReading}</p>
          <small data-free-cast-boundary>{zh ? "免费解读说明卦象本身，不针对你的具体处境。" : "This free layer explains the cast itself, not your specific situation."}</small>
        </div>
      </section>

      <section className={styles.pair} aria-label={zh ? "本卦与之卦" : "Primary and Relating Hexagrams"}>
        <HexCard kind="primary" reading={reading} model={model} zh={zh} />
        {relating ? <HexCard kind="relating" reading={reading} model={model} zh={zh} /> : <StillCard zh={zh} copy={model.transition} />}
      </section>

      <section className={styles.changing} data-changing-lines>
        <Art asset={A.changing} className={styles.art} />
        <div className={styles.changingContent}>
          <div className={styles.changeVisual}>
            <div className={styles.linePills}>
              {moving.length ? moving.map((p) => <span key={p}>{zh ? `第 ${p} 爻` : `Line ${p}`}</span>) : <span>{zh ? "无动爻" : "No changing lines"}</span>}
            </div>
            <div className={styles.changingHex}><HexagramLines lines={[...reading.lineValuesBottomUp]} size="lg" locale={zh ? "zh-Hans" : "en"} /></div>
          </div>
          <div className={styles.changeCopy}>
            <h2>{zh ? "动爻" : "Changing Line(s)"}</h2>
            {model.activeLines.length ? (
              <div className={styles.activeLines}>
                {model.activeLines.map((line) => (
                  <article key={line.position} data-active-line={line.position}>
                    <strong>{zh ? `第 ${line.position} 爻` : `Line ${line.position}`}</strong>
                    <p>{line.coreMeaning}</p>
                    <p>{line.changeMeaning}</p>
                  </article>
                ))}
              </div>
            ) : <p>{model.changing}</p>}
          </div>
        </div>
      </section>

      <section className={styles.transition} data-reading-transition>
        <Art asset={A.transition} className={styles.art} />
        <div className={styles.transitionContent}>
          <h2>{zh ? "变化过程" : "The Transition"}</h2>
          <div className={styles.flow}>
            <div className={styles.flowNode}>
              <HexagramLines lines={[...reading.lineValuesBottomUp]} size="sm" locale={zh ? "zh-Hans" : "en"} />
              <div><strong>{model.primary.englishName}</strong><span>{zh ? "当前状态" : "Current State"}</span></div>
            </div>
            <b aria-hidden="true">→</b>
            <div className={styles.flowChange}>
              <strong>{moving.length ? (zh ? `第 ${linesLabel} 爻变化` : `${moving.length === 1 ? "Line" : "Lines"} ${linesLabel} Change`) : (zh ? "没有动爻" : "No Change")}</strong>
              <span>{moving.length ? model.changing : (zh ? "卦象保持不变" : "The cast remains still")}</span>
            </div>
            <b aria-hidden="true">→</b>
            <div className={styles.flowNode}>
              <HexagramLines lines={relating ? transformedLines : [...reading.lineValuesBottomUp]} size="sm" locale={zh ? "zh-Hans" : "en"} />
              <div><strong>{relating?.englishName ?? model.primary.englishName}</strong><span>{zh ? "变化方向" : "Where It's Heading"}</span></div>
            </div>
          </div>
          <p className={styles.transitionCopy}>{model.transition}</p>
        </div>
      </section>

      <Cta placement="bottom" zh={zh} action={deepAction} unavailable={deepUnavailableMessage} />
    </main>
  );
}
