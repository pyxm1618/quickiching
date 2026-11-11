"use client";

import React from "react";
import type { PublicReadingMethod } from "@/domain/public-reading/types";
import { getDictionary } from "@/i18n/dictionaries";

type Locale = "en" | "zh-Hans";

const ui = {
  root: { display: "grid", gap: 18, textAlign: "left" } satisfies React.CSSProperties,
  stage: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", color: "#74512c", fontSize: 11, fontWeight: 720, letterSpacing: ".08em", textTransform: "uppercase" } satisfies React.CSSProperties,
  done: { display: "inline-flex", alignItems: "center", gap: 6, color: "#346353" } satisfies React.CSSProperties,
  title: { margin: 0, color: "#2a1a10", fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 4vw, 2.65rem)", fontWeight: 680, lineHeight: 1.06 } satisfies React.CSSProperties,
  credit: { display: "flex", gap: 12, alignItems: "baseline", padding: "14px 16px", border: "1px solid rgba(137,94,43,.28)", borderRadius: 14, background: "rgba(255,255,255,.3)" } satisfies React.CSSProperties,
  creditLabel: { color: "#72573b", fontSize: 12 } satisfies React.CSSProperties,
  creditValue: { color: "#2b1c12", fontSize: 26 } satisfies React.CSSProperties,
  cast: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%, 150px),1fr))", overflow: "hidden", border: "1px solid rgba(137,94,43,.26)", borderRadius: 16 } satisfies React.CSSProperties,
  cell: { minHeight: 84, padding: 14, border: "1px solid rgba(137,94,43,.14)" } satisfies React.CSSProperties,
  cellLabel: { display: "block", color: "#816549", fontSize: 10, lineHeight: 1.25 } satisfies React.CSSProperties,
  cellValue: { display: "block", marginTop: 7, color: "#342216", fontFamily: "var(--font-display)", fontSize: 16, lineHeight: 1.15 } satisfies React.CSSProperties,
  cta: { minHeight: 52, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 24px", border: "1px solid #83502a", borderRadius: 999, color: "#fff1d2", background: "linear-gradient(135deg,#9a551f,#642f14)", fontWeight: 760, cursor: "pointer" } satisfies React.CSSProperties,
  note: { margin: 0, color: "#6c533a", fontSize: 12, lineHeight: 1.55 } satisfies React.CSSProperties,
};

export function DeepReadingNeedCredits({
  locale,
  balance,
  method,
  primaryHexagram,
  changingLines,
  relatingHexagram,
  onOpenPricing,
}: {
  locale: Locale;
  balance: number;
  method: PublicReadingMethod;
  primaryHexagram: number;
  changingLines: readonly number[];
  relatingHexagram: number | null;
  onOpenPricing: () => void;
}) {
  const copy = getDictionary(locale).commercial;
  const methodLabel = method === "three-coin"
    ? copy.methodThreeCoin
    : method === "yarrow-stalks"
      ? copy.methodYarrow
      : method === "mei-hua-yi-shu"
        ? copy.methodMeiHua
        : copy.methodManual;

  return (
    <section
      style={ui.root}
      data-deep-reading-state="need-credits"
      data-casting-method={method}
      data-current-balance={balance}
      aria-labelledby="need-credits-title"
    >
      <div style={ui.stage}>
        <span style={ui.done}><span aria-hidden="true">✓</span>{copy.needCreditsStageFree}</span>
        <span aria-hidden="true">›</span>
        <span>{copy.needCreditsStageDeep}</span>
      </div>
      <h2 id="need-credits-title" style={ui.title}>{copy.needCreditsTitle}</h2>
      <div style={ui.credit}>
        <span style={ui.creditLabel}>{copy.needCreditsBalance}</span>
        <strong style={ui.creditValue}>{balance} {balance === 1 ? copy.creditSingular : copy.creditPlural}</strong>
      </div>
      <div style={ui.cast} aria-label={copy.needCreditsStageDeep}>
        <div style={ui.cell}><span style={ui.cellLabel}>{copy.needCreditsMethod}</span><strong style={ui.cellValue}>{methodLabel}</strong></div>
        <div style={ui.cell}><span style={ui.cellLabel}>{copy.needCreditsPrimary}</span><strong style={ui.cellValue}>#{primaryHexagram}</strong></div>
        <div style={ui.cell}><span style={ui.cellLabel}>{copy.needCreditsMoving}</span><strong style={ui.cellValue}>{changingLines.length ? changingLines.join(", ") : copy.needCreditsNoMoving}</strong></div>
        <div style={ui.cell}><span style={ui.cellLabel}>{copy.needCreditsRelating}</span><strong style={ui.cellValue}>{relatingHexagram === null ? copy.needCreditsNoRelating : "#" + relatingHexagram}</strong></div>
      </div>
      <button type="button" onClick={onOpenPricing} style={ui.cta}>{copy.needCreditsCta}</button>
      <p style={ui.note}>{copy.needCreditsNote}</p>
    </section>
  );
}
