
import type { ReactNode } from "react";
import styles from "./info-pages.module.css";

export type InfoLineValue = 6 | 7 | 8 | 9;
export type InfoLinePolarity = "yin" | "yang";
export const PRIMARY_RELATING_SINGLE_CHANGE_VALUES = [7, 7, 7, 6, 7, 7] as const satisfies readonly InfoLineValue[];

export function linePolarity(value: InfoLineValue): InfoLinePolarity {
  return value === 6 || value === 8 ? "yin" : "yang";
}
export function relatingPolarity(value: InfoLineValue): InfoLinePolarity {
  if (value === 6) return "yang";
  if (value === 9) return "yin";
  return linePolarity(value);
}
function HexLine({ polarity, changing = false, label }: { polarity: InfoLinePolarity; changing?: boolean; label: string; }) {
  const className = changing ? styles.lineGraphic + " " + styles.lineChanging : styles.lineGraphic;
  return (
    <div className={className} role="img" aria-label={label}>
      {polarity === "yang" ? <span className={styles.lineSegment} /> : <>
        <span className={styles.lineSegment} />
        <span className={styles.lineSegment} />
      </>}
    </div>
  );
}
export function ChangingLinesPrimer({ children }: { children?: ReactNode; }) {
  const lineExample = (value: InfoLineValue, label: string) =>
    <div className={styles.diagramCard}>
      <div className={styles.diagramCaption}>
        <span className={styles.diagramValue}>{value}</span>
        <p className={styles.diagramLabel}>{label}</p>
      </div>
      <div className={styles.lineTransition}>
        <HexLine polarity={linePolarity(value)} changing={value === 9} label={`${value}: ${label}, ${value === 6 || value === 9 ? "changing" : "stable"}`} />
        {value === 6 || value === 9 ? <>
          <span className={styles.changeArrow} aria-hidden="true">→</span>
          <HexLine polarity={relatingPolarity(value)} changing={value === 6} label={value === 6 ? "Changes to Yang" : "Changes to Yin"} />
        </> : null}
      </div>
      <p className={styles.diagramNote}>{value === 6 ? "Yin → Yang" : value === 9 ? "Yang → Yin" : "Stable"}</p>
    </div>;
  return <div className={styles.changingPrimer} aria-label="The four I Ching line values">
    <section className={styles.primerColumn}>
      <h3>Six Lines</h3>
      <div className={styles.sixLines}>
        <span aria-hidden="true">↑</span>
        <div className={styles.lineStack}>{[6, 5, 4, 3, 2, 1].map(position =>
          <div className={styles.numberedLine} key={position}>
            <HexLine polarity="yang" label={`Line ${position}`} />
            <span>Line {position}</span>
          </div>)}</div>
      </div>
    </section>
    <section className={styles.primerColumn}>
      <h3>Stable Lines</h3>{lineExample(7, "Young Yang")}{lineExample(8, "Young Yin")}</section>
    <section className={styles.primerColumn}>
      <h3>Changing Lines</h3>{lineExample(6, "Old Yin")}{lineExample(9, "Old Yang")}</section>
    <section className={styles.primerColumn}>
      <h3>From Primary to Relating Hexagram</h3>{children}<PrimaryRelatingPrimer compact />
    </section>
  </div>;
}
export function PrimaryRelatingPrimer({ descriptions, compact = false }: { descriptions?: readonly ReactNode[]; compact?: boolean; }) {
  const topDown = [...PRIMARY_RELATING_SINGLE_CHANGE_VALUES].reverse();
  return (
    <div className={`${styles.primaryFlow} ${compact ? styles.miniFlow : ""}`} aria-label="Primary to relating hexagram example with one changing line">
      <div className={styles.flowColumn}>
        <h3>Primary Hexagram</h3>
        <div className={styles.flowBody}>
          <div className={styles.lineStack}>
            {topDown.map((value, index) =>
              <HexLine key={"primary-" + index} polarity={linePolarity(value)} changing={value === 6} label={"Primary line " + (6 - index)} />)}
          </div>{descriptions?.[0]}</div>
      </div>
      <div className={styles.flowArrow} aria-hidden="true">
        <svg viewBox="0 0 120 70">
          <path d="M4 57 Q38 15 77 29 L73 8 L115 36 L79 65 L80 45 Q40 32 4 57Z" fill="#dc941d" stroke="#fff0ba" strokeWidth="3" />
        </svg>
      </div>
      <div className={styles.flowColumn}>
        <h3>Changing Lines</h3>{descriptions?.[1]}<div className={styles.changeExample}>
          <HexLine polarity="yin" changing label="Changing yin line" />
          <span className={styles.changeArrow} aria-hidden="true">→</span>
          <HexLine polarity="yang" changing label="Changed yang line" />
        </div>
      </div>
      <div className={styles.flowArrow} aria-hidden="true">
        <svg viewBox="0 0 120 70">
          <path d="M4 57 Q38 15 77 29 L73 8 L115 36 L79 65 L80 45 Q40 32 4 57Z" fill="#dc941d" stroke="#fff0ba" strokeWidth="3" />
        </svg>
      </div>
      <div className={styles.flowColumn}>
        <h3>Relating Hexagram</h3>
        <div className={styles.flowBody}>
          <div className={styles.lineStack}>
            {topDown.map((value, index) =>
              <HexLine key={"relating-" + index} polarity={relatingPolarity(value)} changing={value === 6} label={"Relating line " + (6 - index)} />)}
          </div>{descriptions?.[2]}</div>
      </div>
    </div>
  );
}
