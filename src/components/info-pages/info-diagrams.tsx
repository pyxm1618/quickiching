
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
function HexLine({ polarity, changing = false, label }: { polarity: InfoLinePolarity; changing?: boolean; label: string }) {
  const className = changing ? styles.lineGraphic + " " + styles.lineChanging : styles.lineGraphic;
  return (
    <div className={className} role="img" aria-label={label}>
      {polarity === "yang" ? <span className={styles.lineSegment} /> : <><span className={styles.lineSegment} /><span className={styles.lineSegment} /></>}
    </div>
  );
}
export function ChangingLinesPrimer() {
  const rows: Array<{ value: InfoLineValue; label: string; note: string }> = [
    { value: 7, label: "Young Yang", note: "Stable" },
    { value: 8, label: "Young Yin", note: "Stable" },
    { value: 6, label: "Old Yin", note: "Changing → Yang" },
    { value: 9, label: "Old Yang", note: "Changing → Yin" },
  ];
  return (
    <div className={styles.diagramGrid} aria-label="The four I Ching line values">
      {rows.map(({ value, label, note }) => {
        const changing = value === 6 || value === 9;
        const ariaLabel = String(value) + ": " + label + (changing ? ", changing" : ", stable");
        return <div className={styles.diagramCard} key={value}>
          <span className={styles.diagramValue}>{value}</span>
          <p className={styles.diagramLabel}>{label}</p>
          <HexLine polarity={linePolarity(value)} changing={changing} label={ariaLabel} />
          <p className={styles.diagramNote}>{note}</p>
        </div>;
      })}
    </div>
  );
}
export function PrimaryRelatingPrimer() {
  const topDown = [...PRIMARY_RELATING_SINGLE_CHANGE_VALUES].reverse();
  return (
    <div className={styles.primaryFlow} aria-label="Primary to relating hexagram example with one changing line">
      <div className={styles.flowColumn}><h3>Primary Hexagram</h3><div className={styles.lineStack}>
        {topDown.map((value,index)=><HexLine key={"primary-"+index} polarity={linePolarity(value)} changing={value===6||value===9} label={"Primary line "+(6-index)} />)}
      </div></div>
      <div className={styles.flowArrow} aria-hidden="true">→</div>
      <div className={styles.flowColumn}><h3>Changing Lines</h3><div className={styles.changeExample}>
        <HexLine polarity="yin" changing label="Changing yin line" /><span className={styles.changeArrow} aria-hidden="true">→</span><HexLine polarity="yang" changing label="Changed yang line" />
      </div></div>
      <div className={styles.flowArrow} aria-hidden="true">→</div>
      <div className={styles.flowColumn}><h3>Relating Hexagram</h3><div className={styles.lineStack}>
        {topDown.map((value,index)=><HexLine key={"relating-"+index} polarity={relatingPolarity(value)} changing={value===6||value===9} label={"Relating line "+(6-index)} />)}
      </div></div>
    </div>
  );
}
