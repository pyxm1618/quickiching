/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import type { PublicReading } from "@/domain/public-reading/types";
import { readCompletedPublicReading } from "@/lib/completed-public-reading";
import styles from "./result-choice.module.css";

type ChoiceState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "ready"; reading: PublicReading };

const RESULT_CHOICE_ASSETS = {
  primary: "/result-choice/primary-stone.avif",
  leftBlossom: "/result-choice/left-blossom.avif",
  taiji: "/result-choice/taiji-transition.avif",
  rightForeground: "/result-choice/right-foreground.avif",
  question: "/result-choice/question-banner.avif",
  changing: "/result-choice/changing-stone.avif",
} as const;

function relatingLineValues(lines: readonly number[]): number[] {
  return lines.map((value) => value === 6 ? 7 : value === 9 ? 8 : value);
}

/* Length-aware title tier for the approved stone slot.
   The approved Desktop plate leaves roughly 283 px of clear width between the left
   foreground blossom and the stone's right silhouette. Names that render wider than
   that are stepped down once, to 80 % of the approved 30 px, which is the smallest
   step that still keeps every one of the 64 classical names clear of both the plate
   and the blossom without dropping to an illegible size. The tier is derived from the
   rendered name only — never from a hexagram number. */
function nameScaleFor(name: string): number {
  return name.trim().length <= 16 ? 1 : 0.8;
}

function HexagramGlyph({
  lines,
  movingPositions = [],
}: {
  lines: readonly number[];
  movingPositions?: readonly number[];
}) {
  const moving = new Set(movingPositions);
  return (
    <div className={styles.lines} aria-hidden="true">
      {[5, 4, 3, 2, 1, 0].map((index) => {
        const value = lines[index];
        const yang = value === 7 || value === 9;
        const changing = moving.has(index + 1);
        return (
          <div
            key={index}
            className={`${styles.line} ${yang ? styles.yang : styles.yin} ${changing ? styles.changing : ""}`}
          >
            <span />
            <span />
          </div>
        );
      })}
    </div>
  );
}

export function ResultChoiceView({
  reading,
  locale = "en",
}: {
  reading: PublicReading;
  locale?: "en" | "zh-Hans";
}) {
  const zh = locale === "zh-Hans";
  const prefix = zh ? "/zh" : "";
  const primary = hexagramByNumber(reading.primaryHexagram);
  const relating = reading.relatingHexagram === null ? null : hexagramByNumber(reading.relatingHexagram);
  const changedLines = relatingLineValues(reading.lineValuesBottomUp);
  /* A cast with no moving line has no relating hexagram: the primary pattern simply
     stands. The right-hand stone then speaks the no-change truth instead of
     inventing a 变卦 / relating figure. */
  const unchanged = reading.changingLines.length === 0 && relating === null;
  const freeHref = `${prefix}/readings/result?session=${encodeURIComponent(reading.id)}`;
  const deepHref = `${prefix}/readings/deep?session=${encodeURIComponent(reading.id)}`;
  const changingLabel = reading.changingLines.length
    ? (zh ? `动爻：第 ${reading.changingLines.join("、")} 爻` : `Changing line${reading.changingLines.length > 1 ? "s" : ""}: ${reading.changingLines.join(", ")}`)
    : (zh ? "无动爻" : "No changing lines");
  const question = reading.question?.trim() || (zh ? "本次起卦未记录问题" : "No question was recorded for this cast.");

  return (
    <main
      className={styles.page}
      data-result-choice
      data-reading-method={reading.method}
      data-reading-session={reading.id}
    >
      <div className={styles.scene}>
        <div className={`${styles.artLayer} ${styles.leftBlossom}`} aria-hidden="true">
          <img src={RESULT_CHOICE_ASSETS.leftBlossom} width="650" height="478" alt="" decoding="async" />
        </div>

        <section className={styles.questionBanner} data-result-choice-question>
          <img src={RESULT_CHOICE_ASSETS.question} width="900" height="300" alt="" fetchPriority="high" />
          <p className={styles.questionLabel}>{zh ? "你的问题" : "Your Question"}</p>
          <h1 className={styles.questionText}>{question}</h1>
        </section>

        <section className={`${styles.stone} ${styles.primaryStone}`} data-result-choice-primary>
          <img src={RESULT_CHOICE_ASSETS.primary} width="650" height="597" alt="" fetchPriority="high" />
          <p className={styles.stoneTitle}>{zh ? "本卦" : "Primary Hexagram"}</p>
          <h2 className={styles.stoneName} style={{ "--name-scale": nameScaleFor(zh ? primary.chineseName : primary.englishName) } as React.CSSProperties}>{zh ? primary.chineseName : primary.englishName}</h2>
          <p className={styles.stoneSecondary}>
            {zh ? `第 ${primary.number} 卦` : `${primary.chineseName} · Hexagram ${primary.number}`}
          </p>
          <HexagramGlyph lines={reading.lineValuesBottomUp} movingPositions={reading.changingLines} />
          <p className={styles.verticalName}>{primary.chineseName}</p>
          <p className={styles.stoneSeal}>{zh ? "本卦" : "本卦"}</p>
          <p className={styles.stoneCopy}>
            <span>{zh ? "当前卦象" : "Current pattern"}</span>
            <span>{zh ? `第 ${primary.number} 卦` : `Hexagram ${primary.number}`}</span>
          </p>
        </section>

        <div className={styles.transition} data-result-choice-changing>
          <img src={RESULT_CHOICE_ASSETS.taiji} width="520" height="347" alt="" fetchPriority="high" />
          <p className={styles.changingAnnotation}>{changingLabel}</p>
        </div>

        <section
          className={`${styles.stone} ${styles.changingStone}`}
          data-result-choice-relating
          data-result-choice-relating-state={unchanged ? "unchanged" : "changing"}
        >
          <img src={RESULT_CHOICE_ASSETS.changing} width="650" height="580" alt="" fetchPriority="high" />
          <p className={styles.stoneTitle}>
            {unchanged
              ? (zh ? "卦象不变" : "Unchanged Hexagram")
              : (zh ? "变卦" : "Changing Hexagram")}
          </p>
          {unchanged ? (
            <>
              <h2 className={styles.stoneName} style={{ "--name-scale": nameScaleFor(zh ? primary.chineseName : primary.englishName) } as React.CSSProperties}>{zh ? primary.chineseName : primary.englishName}</h2>
              <p className={styles.stoneSecondary}>
                {zh ? `第 ${primary.number} 卦` : `${primary.chineseName} · Hexagram ${primary.number}`}
              </p>
              <HexagramGlyph lines={reading.lineValuesBottomUp} />
              <p className={styles.verticalName}>{primary.chineseName}</p>
              <p className={styles.stoneSeal}>不变</p>
              <p className={styles.stoneCopy}>
                <span>{zh ? "无动爻" : "No moving lines"}</span>
                <span>{zh ? "卦象不变" : "Unchanged hexagram"}</span>
              </p>
            </>
          ) : relating ? (
            <>
              <h2 className={styles.stoneName} style={{ "--name-scale": nameScaleFor(zh ? relating.chineseName : relating.englishName) } as React.CSSProperties}>{zh ? relating.chineseName : relating.englishName}</h2>
              <p className={styles.stoneSecondary}>
                {zh ? `第 ${relating.number} 卦` : `${relating.chineseName} · Hexagram ${relating.number}`}
              </p>
              {/* The relating glyph shows the post-change yin/yang values while the
                  real changing positions carry the crimson emphasis. */}
              <HexagramGlyph lines={changedLines} movingPositions={reading.changingLines} />
              <p className={styles.verticalName}>{relating.chineseName}</p>
              <p className={styles.stoneSeal}>变卦</p>
              <p className={styles.stoneCopy}>
                <span>{zh ? "之卦" : "Relating"}</span>
                <span>{zh ? `第 ${relating.number} 卦` : `Hexagram ${relating.number}`}</span>
              </p>
            </>
          ) : null}
        </section>

        <div className={`${styles.artLayer} ${styles.rightForeground}`} aria-hidden="true">
          <img src={RESULT_CHOICE_ASSETS.rightForeground} width="650" height="412" alt="" decoding="async" />
        </div>

        <nav className={styles.actions} aria-label={zh ? "选择解读方式" : "Choose a reading"}>
          <Link href={deepHref} className={styles.deepAction} data-result-choice-deep>
            <strong>{zh ? "深度解读" : "Deep Reading"}</strong>
          </Link>
          <Link href={freeHref} className={styles.freeAction} data-result-choice-free>
            {zh ? "免费解卦" : "Free Reading"}
          </Link>
        </nav>

        {/* S12 is a Flow Step: it owns an explicit local exit, so leaving the
            reading never depends on the shell brand or discovery navigation. */}
        <Link href={zh ? "/zh" : "/"} prefetch={false} className={styles.exitAction} data-result-choice-exit>
          {zh ? "退出解读" : "Exit Reading"}
        </Link>
      </div>
    </main>
  );
}

export function ResultChoiceClient({
  initialSessionId,
  locale = "en",
  initialReading,
}: {
  initialSessionId?: string;
  locale?: "en" | "zh-Hans";
  initialReading?: PublicReading;
}) {
  const zh = locale === "zh-Hans";
  const [state, setState] = useState<ChoiceState>(() => initialReading
    ? { kind: "ready", reading: initialReading }
    : { kind: "loading" });

  useEffect(() => {
    if (initialReading) return;
    const reading = readCompletedPublicReading(initialSessionId);
    setState(reading ? { kind: "ready", reading } : { kind: "empty" });
  }, [initialReading, initialSessionId]);

  if (state.kind === "loading") {
    return <div className={styles.status} role="status">{zh ? "正在恢复已完成的起卦…" : "Restoring your completed cast…"}</div>;
  }

  if (state.kind === "empty") {
    return (
      <main className={styles.page} data-result-choice-empty>
        <section className={styles.emptyState}>
          <p>{zh ? "起卦结果" : "Completed Cast"}</p>
          <h1>{zh ? "没有找到这次已完成的起卦" : "No completed cast was found"}</h1>
          <Link href={zh ? "/zh" : "/"} className={styles.emptyAction}>{zh ? "返回起卦入口" : "Return to casting methods"}</Link>
        </section>
      </main>
    );
  }

  return <ResultChoiceView reading={state.reading} locale={locale} />;
}