"use client";

import { CheckCircle2, ChevronRight } from "lucide-react";
import type { PublicReadingMethod } from "@/domain/public-reading/types";
import { getDictionary } from "@/i18n/dictionaries";
import styles from "./commercial-ui.module.css";

type Locale = "en" | "zh-Hans";

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
      className={styles.needCredits}
      data-deep-reading-state="need-credits"
      data-casting-method={method}
      data-current-balance={balance}
      aria-labelledby="need-credits-title"
    >
      <div className={styles.stageRow}>
        <span className={styles.stageDone}><CheckCircle2 aria-hidden="true" size={15} />{copy.needCreditsStageFree}</span>
        <ChevronRight aria-hidden="true" size={14} />
        <span>{copy.needCreditsStageDeep}</span>
      </div>
      <h2 id="need-credits-title">{copy.needCreditsTitle}</h2>
      <div className={styles.creditRow}>
        <span>{copy.needCreditsBalance}</span>
        <strong>{balance} {balance === 1 ? copy.creditSingular : copy.creditPlural}</strong>
      </div>
      <div className={styles.castGrid} aria-label={copy.needCreditsStageDeep}>
        <div className={styles.castCell}><span>{copy.needCreditsMethod}</span><strong>{methodLabel}</strong></div>
        <div className={styles.castCell}><span>{copy.needCreditsPrimary}</span><strong>#{primaryHexagram}</strong></div>
        <div className={styles.castCell}><span>{copy.needCreditsMoving}</span><strong>{changingLines.length ? changingLines.join(", ") : copy.needCreditsNoMoving}</strong></div>
        <div className={styles.castCell}><span>{copy.needCreditsRelating}</span><strong>{relatingHexagram === null ? copy.needCreditsNoRelating : "#" + relatingHexagram}</strong></div>
      </div>
      <button type="button" onClick={onOpenPricing} className={styles.needCta}>{copy.needCreditsCta}</button>
      <p className={styles.needNote}>{copy.needCreditsNote}</p>
    </section>
  );
}
