import type { ReactNode } from "react";
import type { ContentLocale } from "@/i18n/config";
import styles from "./info-pages.module.css";

export type InfoLineValue = 6 | 7 | 8 | 9;
export type InfoLinePolarity = "yin" | "yang";
export const PRIMARY_RELATING_SINGLE_CHANGE_VALUES = [7, 7, 7, 6, 7, 7] as const satisfies readonly InfoLineValue[];

const DIAGRAM_COPY = {
  en: {
    primerAria: "The four I Ching line values", sixLines: "Six Lines", stableLines: "Stable Lines", changingLines: "Changing Lines",
    fromPrimaryToRelating: "From Primary to Relating Hexagram", youngYang: "Young Yang", youngYin: "Young Yin", oldYin: "Old Yin", oldYang: "Old Yang",
    stable: "Stable", changing: "changing", yinToYang: "Yin → Yang", yangToYin: "Yang → Yin", changesToYang: "Changes to Yang", changesToYin: "Changes to Yin",
    primaryHexagram: "Primary Hexagram", relatingHexagram: "Relating Hexagram", flowAria: "Primary to relating hexagram example with one changing line",
    changingYinLine: "Changing yin line", changedYangLine: "Changed yang line",
    line: (n: number) => `Line ${n}`, primaryLine: (n: number) => `Primary line ${n}`, relatingLine: (n: number) => `Relating line ${n}`,
  },
  "zh-Hans": {
    primerAria: "易经四种爻值", sixLines: "六爻", stableLines: "稳定爻", changingLines: "动爻", fromPrimaryToRelating: "从本卦到之卦",
    youngYang: "少阳", youngYin: "少阴", oldYin: "老阴", oldYang: "老阳", stable: "稳定", changing: "变化", yinToYang: "阴 → 阳", yangToYin: "阳 → 阴",
    changesToYang: "变为阳爻", changesToYin: "变为阴爻", primaryHexagram: "本卦", relatingHexagram: "之卦", flowAria: "本卦通过一个动爻变为之卦的示例",
    changingYinLine: "变化中的阴爻", changedYangLine: "变化后的阳爻",
    line: (n: number) => `第 ${n} 爻`, primaryLine: (n: number) => `本卦第 ${n} 爻`, relatingLine: (n: number) => `之卦第 ${n} 爻`,
  },
} satisfies Record<ContentLocale, Record<string, string | ((position: number) => string)>>;

export function linePolarity(value: InfoLineValue): InfoLinePolarity { return value === 6 || value === 8 ? "yin" : "yang"; }
export function relatingPolarity(value: InfoLineValue): InfoLinePolarity {
  if (value === 6) return "yang";
  if (value === 9) return "yin";
  return linePolarity(value);
}
function HexLine({ polarity, changing = false, label }: { polarity: InfoLinePolarity; changing?: boolean; label: string; }) {
  const className = changing ? styles.lineGraphic + " " + styles.lineChanging : styles.lineGraphic;
  return <div className={className} role="img" aria-label={label}>
    {polarity === "yang" ? <span className={styles.lineSegment} /> : <><span className={styles.lineSegment} /><span className={styles.lineSegment} /></>}
  </div>;
}
export function ChangingLinesPrimer({ children, locale = "en" }: { children?: ReactNode; locale?: ContentLocale; }) {
  const copy = DIAGRAM_COPY[locale];
  const lineExample = (value: InfoLineValue, label: string) => {
    const isChanging = value === 6 || value === 9;
    return <div className={styles.diagramCard}>
      <div className={styles.diagramCaption}><span className={styles.diagramValue}>{value}</span><p className={styles.diagramLabel}>{label}</p></div>
      <div className={styles.lineTransition}>
        <HexLine polarity={linePolarity(value)} changing={value === 9} label={`${value}: ${label}, ${isChanging ? copy.changing : copy.stable}`} />
        {isChanging ? <><span className={styles.changeArrow} aria-hidden="true">→</span>
          <HexLine polarity={relatingPolarity(value)} changing={value === 6} label={value === 6 ? copy.changesToYang as string : copy.changesToYin as string} /></> : null}
      </div>
      <p className={styles.diagramNote}>{value === 6 ? copy.yinToYang as string : value === 9 ? copy.yangToYin as string : copy.stable as string}</p>
    </div>;
  };
  const line = copy.line as (position: number) => string;
  return <div className={styles.changingPrimer} aria-label={copy.primerAria as string}>
    <section className={styles.primerColumn}><h3>{copy.sixLines as string}</h3><div className={styles.sixLines}><span aria-hidden="true">↑</span>
      <div className={styles.lineStack}>{[6,5,4,3,2,1].map(position => <div className={styles.numberedLine} key={position}>
        <HexLine polarity="yang" label={line(position)} /><span>{line(position)}</span>
      </div>)}</div></div></section>
    <section className={styles.primerColumn}><h3>{copy.stableLines as string}</h3>{lineExample(7,copy.youngYang as string)}{lineExample(8,copy.youngYin as string)}</section>
    <section className={styles.primerColumn}><h3>{copy.changingLines as string}</h3>{lineExample(6,copy.oldYin as string)}{lineExample(9,copy.oldYang as string)}</section>
    <section className={styles.primerColumn}><h3>{copy.fromPrimaryToRelating as string}</h3>{children}<PrimaryRelatingPrimer compact locale={locale} /></section>
  </div>;
}
export function PrimaryRelatingPrimer({ descriptions, compact = false, locale = "en" }: { descriptions?: readonly ReactNode[]; compact?: boolean; locale?: ContentLocale; }) {
  const copy = DIAGRAM_COPY[locale];
  const topDown = [...PRIMARY_RELATING_SINGLE_CHANGE_VALUES].reverse();
  const primaryLine = copy.primaryLine as (position: number) => string;
  const relatingLine = copy.relatingLine as (position: number) => string;
  return <div className={`${styles.primaryFlow} ${compact ? styles.miniFlow : ""}`} aria-label={copy.flowAria as string}>
    <div className={styles.flowColumn}><h3>{copy.primaryHexagram as string}</h3><div className={styles.flowBody}><div className={styles.lineStack}>
      {topDown.map((value,index)=><HexLine key={"primary-"+index} polarity={linePolarity(value)} changing={value===6} label={primaryLine(6-index)} />)}
    </div>{descriptions?.[0]}</div></div>
    <div className={styles.flowArrow} aria-hidden="true"><svg viewBox="0 0 120 70"><path d="M4 57 Q38 15 77 29 L73 8 L115 36 L79 65 L80 45 Q40 32 4 57Z" fill="#dc941d" stroke="#fff0ba" strokeWidth="3" /></svg></div>
    <div className={styles.flowColumn}><h3>{copy.changingLines as string}</h3>{descriptions?.[1]}<div className={styles.changeExample}>
      <HexLine polarity="yin" changing label={copy.changingYinLine as string} /><span className={styles.changeArrow} aria-hidden="true">→</span>
      <HexLine polarity="yang" changing label={copy.changedYangLine as string} /></div></div>
    <div className={styles.flowArrow} aria-hidden="true"><svg viewBox="0 0 120 70"><path d="M4 57 Q38 15 77 29 L73 8 L115 36 L79 65 L80 45 Q40 32 4 57Z" fill="#dc941d" stroke="#fff0ba" strokeWidth="3" /></svg></div>
    <div className={styles.flowColumn}><h3>{copy.relatingHexagram as string}</h3><div className={styles.flowBody}><div className={styles.lineStack}>
      {topDown.map((value,index)=><HexLine key={"relating-"+index} polarity={relatingPolarity(value)} changing={value===6} label={relatingLine(6-index)} />)}
    </div>{descriptions?.[2]}</div></div>
  </div>;
}
