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

function relatingLineValues(lines: readonly number[]): number[] {
  return lines.map((value) => value === 6 ? 7 : value === 9 ? 8 : value);
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
  const freeHref = `${prefix}/readings/result?session=${encodeURIComponent(reading.id)}`;
  const deepHref = `${prefix}/readings/deep?session=${encodeURIComponent(reading.id)}`;
  const changingLabel = reading.changingLines.length
    ? (zh ? `动爻：第 ${reading.changingLines.join("、")} 爻` : `Changing line${reading.changingLines.length > 1 ? "s" : ""}: ${reading.changingLines.join(", ")}`)
    : (zh ? "无动爻" : "No changing lines");

  return (
    <main
      className={styles.page}
      data-result-choice
      data-reading-method={reading.method}
      data-reading-session={reading.id}
    >
      <section className={styles.questionCard} data-result-choice-question>
        <p>{zh ? "你的问题" : "Your Question"}</p>
        <h1>{reading.question?.trim() || (zh ? "本次起卦未记录问题" : "No question was recorded for this cast.")}</h1>
      </section>

      <section className={styles.resultCard} aria-label={zh ? "本次起卦摘要" : "Completed cast summary"}>
        <div className={styles.hexagramCard} data-result-choice-primary>
          <p className={styles.eyebrow}>{zh ? "本卦" : "Primary Hexagram"}</p>
          <h2>{zh ? `第 ${primary.number} 卦 · ${primary.chineseName}` : `Hexagram ${primary.number} · ${primary.englishName}`}</h2>
          {!zh ? <p className={styles.secondaryName}>{primary.chineseName}</p> : null}
          <HexagramGlyph lines={reading.lineValuesBottomUp} movingPositions={reading.changingLines} />
        </div>

        <div className={styles.transition} data-result-choice-changing>
          <span className={styles.arrow} aria-hidden="true">↔</span>
          <p>{changingLabel}</p>
        </div>

        <div className={styles.hexagramCard} data-result-choice-relating>
          <p className={styles.eyebrow}>{zh ? "变卦 / 之卦" : "Changing / Relating Hexagram"}</p>
          {relating ? (
            <>
              <h2>{zh ? `第 ${relating.number} 卦 · ${relating.chineseName}` : `Hexagram ${relating.number} · ${relating.englishName}`}</h2>
              {!zh ? <p className={styles.secondaryName}>{relating.chineseName}</p> : null}
              <HexagramGlyph lines={changedLines} />
            </>
          ) : (
            <>
              <h2>{zh ? "卦象不变" : "Unchanged"}</h2>
              <p className={styles.secondaryName}>{zh ? "本次没有动爻，因此没有之卦。" : "There are no moving lines, so there is no relating hexagram."}</p>
              <HexagramGlyph lines={reading.lineValuesBottomUp} />
            </>
          )}
        </div>
      </section>

      <section className={styles.actions} aria-label={zh ? "选择解读方式" : "Choose a reading"}>
        <Link href={deepHref} className={styles.deepAction} data-result-choice-deep>
          <strong>{zh ? "深度解读" : "Deep Reading"}</strong>
          <span>{zh ? "结合你的问题与本次卦象继续" : "Continue with your question and this exact cast"}</span>
        </Link>
        <Link href={freeHref} className={styles.freeAction} data-result-choice-free>
          <strong>{zh ? "免费解卦" : "Free Reading"}</strong>
          <span>{zh ? "查看本次卦象的基础解读" : "View the basic interpretation of this cast"}</span>
        </Link>
      </section>
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
        <section className={styles.questionCard}>
          <p>{zh ? "起卦结果" : "Completed Cast"}</p>
          <h1>{zh ? "没有找到这次已完成的起卦" : "No completed cast was found"}</h1>
          <Link href={zh ? "/zh" : "/"} className={styles.freeAction}>{zh ? "返回起卦入口" : "Return to casting methods"}</Link>
        </section>
      </main>
    );
  }

  return <ResultChoiceView reading={state.reading} locale={locale} />;
}
