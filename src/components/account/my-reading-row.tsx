import React from "react";
import Link from "next/link";
import type { LineValue } from "@/domain/casting/types";

export type MyReadingDisplay = {
  id: string;
  question: string | null;
  createdAt: Date;
  method: string;
  primaryHexagramNumber: number;
  primaryName: string;
  lineValues: readonly LineValue[];
  movingLinePositions: readonly number[];
  relatingHexagramNumber: number | null;
  relatingName: string | null;
};

function changedLines(values: readonly LineValue[]): LineValue[] {
  return values.map((value) => value === 6 ? 7 : value === 9 ? 8 : value);
}

function HexagramMark({ values, label }: { values: readonly LineValue[]; label: string }) {
  return <span className="qic-reading-hexagram-mark" role="img" aria-label={label}>
    {[...values].reverse().map((value, index) => {
      const yin = value === 6 || value === 8;
      return <span key={index} className={yin ? "qic-reading-line is-yin" : "qic-reading-line is-yang"}>
        <i />{yin ? <i /> : null}
      </span>;
    })}
  </span>;
}

function methodLabel(method: string, zh: boolean) {
  if (method === "three_coin") return zh ? "三硬币法" : "Three-Coin Method";
  if (method === "yarrow_stalk") return zh ? "蓍草法" : "Yarrow Stalks";
  if (method === "mei_hua_number_time") return zh ? "梅花易数" : "Mei Hua Yi Shu";
  if (method === "manual") return zh ? "手动起卦" : "Manual Cast";
  return method;
}

export function MyReadingRow({
  reading,
  zh = false,
  href,
}: {
  reading: MyReadingDisplay;
  zh?: boolean;
  href: string;
}) {
  const relatingValues = changedLines(reading.lineValues);
  const date = reading.createdAt.toLocaleDateString(zh ? "zh-CN" : "en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
  const changing = reading.movingLinePositions.length
    ? (zh ? `动爻 ${reading.movingLinePositions.join("、")}` : `Lines ${reading.movingLinePositions.join(", ")}`)
    : (zh ? "无动爻" : "No changing lines");

  return <Link className="qic-account-paper qic-my-reading" prefetch={false} href={href}>
    <span className="qic-reading-question">
      <strong data-clarity-mask="true" data-private-question="true">{reading.question?.trim() || (zh ? "未命名解读" : "Untitled Reading")}</strong>
      <time dateTime={reading.createdAt.toISOString()}>{date}</time>
    </span>

    <span className="qic-reading-cast">
      <span className="qic-reading-hex-card">
        <HexagramMark values={reading.lineValues} label={zh ? `本卦 ${reading.primaryHexagramNumber}` : `Primary hexagram ${reading.primaryHexagramNumber}`} />
        <span><b>{reading.primaryHexagramNumber}</b><small>{reading.primaryName}</small></span>
      </span>

      <span className="qic-reading-change">
        <small>{zh ? "变化" : "Changing"}</small>
        <strong>{changing}</strong>
        <span aria-hidden="true">→</span>
      </span>

      <span className="qic-reading-hex-card qic-reading-relating">
        {reading.relatingHexagramNumber ? <>
          <HexagramMark values={relatingValues} label={zh ? `之卦 ${reading.relatingHexagramNumber}` : `Relating hexagram ${reading.relatingHexagramNumber}`} />
          <span><b>{reading.relatingHexagramNumber}</b><small>{reading.relatingName}</small></span>
        </> : <span className="qic-reading-unchanging">{zh ? "无之卦" : "Unchanging"}</span>}
      </span>

      <span className="qic-reading-method"><span aria-hidden="true">☯</span><strong>{methodLabel(reading.method, zh)}</strong></span>
    </span>

    <span aria-hidden="true" className="qic-reading-arrow">›</span>
  </Link>;
}
