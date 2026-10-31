"use client";

import React from "react";
import type { PublicReading } from "@/domain/public-reading/types";
import type { buildStaticReading } from "@/domain/public-reading/static-reading";
import "./shared-reading-summary.css";

type ReadingModel = ReturnType<typeof buildStaticReading>;
export type ReadingChoice = "free" | "deep";

function SummaryLines({ lines, zh }: { lines: readonly number[]; zh: boolean }) {
  return <div className="shared-hex-lines" aria-label={zh ? "自下而上的六爻" : "Six lines, bottom to top"}>{[5, 4, 3, 2, 1, 0].map((index) => {
    const yang = lines[index] === 7 || lines[index] === 9;
    const moving = lines[index] === 6 || lines[index] === 9;
    const label = zh ? `第 ${index + 1} 爻：${yang ? "阳爻" : "阴爻"}${moving ? "，动爻" : ""}` : `Line ${index + 1}: ${yang ? "yang" : "yin"}${moving ? ", moving" : ""}`;
    return <div key={index} role="img" aria-label={label} data-line-position={index + 1} data-moving={moving} data-yang={yang}><i /><i /></div>;
  })}</div>;
}

export function SharedReadingSummary({ reading, model, zh, onChoose, busy, error }: {
  reading: PublicReading; model: ReadingModel; zh: boolean;
  onChoose: (choice: ReadingChoice) => void; busy: boolean; error: string;
}) {
  const changed = reading.lineValuesBottomUp.map((value) => value === 6 ? 7 : value === 9 ? 8 : value);
  return <section className="shared-reading-summary" data-shared-reading-summary data-cast-id={reading.id} data-cast-created-at={reading.createdAt} aria-label={zh ? "本次卦象" : "Your cast"}>
    <header className="shared-question" data-private-question="true" data-clarity-mask="true"><h1>{zh ? "你的问题" : "Your Question"}</h1><p>{reading.question || (zh ? "本次起卦未绑定问题" : "A cast without a bound question")}</p></header>
    <div className="shared-cast-tableau">
      <section className="shared-stone shared-primary" data-summary-primary>
        <div className="shared-stone-copy"><h2>{zh ? "本卦" : "Primary Hexagram"}</h2><h3>{model.primary.englishName}</h3><p>{zh ? model.primary.chineseName : `${model.primary.chineseName} · ${model.primary.pinyin}`}</p><SummaryLines lines={reading.lineValuesBottomUp} zh={zh} /><p className="shared-hex-number">{zh ? "第" : "Hexagram"} {reading.primaryHexagram}{zh ? "卦" : ""}</p></div>
      </section>
      <div className="shared-change"><picture><source media="(max-width:600px)" srcSet="/mei-hua/change-orb-mobile.webp" /><img src="/mei-hua/change-orb.webp" alt="" width="1983" height="793" /></picture><div><h2>{zh ? "动爻" : "Changing Line"}</h2><p>{reading.changingLines.length ? `${zh ? "第" : "Line"} ${reading.changingLines.join(", ")}${zh ? "爻" : ""}` : (zh ? "无动爻" : "None")}</p></div></div>
      <section className="shared-stone shared-relating" data-summary-relating>
        <div className="shared-stone-copy"><h2>{zh ? "之卦" : "Relating Hexagram"}</h2>{model.relating ? <><h3>{model.relating.englishName}</h3><p>{zh ? model.relating.chineseName : `${model.relating.chineseName} · ${model.relating.pinyin}`}</p><SummaryLines lines={changed} zh={zh} /><p className="shared-hex-number">{zh ? "第" : "Hexagram"} {reading.relatingHexagram}{zh ? "卦" : ""}</p></> : <p className="shared-no-relating">{zh ? "无之卦 · 六爻皆静" : "No relating hexagram · All six lines are stable"}</p>}</div>
      </section>
    </div>
    <div className="shared-reading-entries"><button type="button" className="shared-deep-entry" onClick={() => onChoose("deep")} disabled={busy} data-reading-choice="deep">{zh ? "深度解读" : "Deep Reading"}</button><button type="button" className="shared-free-entry" onClick={() => onChoose("free")} disabled={busy} data-reading-choice="free">{zh ? "免费解读" : "Free Reading"}</button>{error ? <p role="alert">{error}</p> : null}</div>
  </section>;
}
