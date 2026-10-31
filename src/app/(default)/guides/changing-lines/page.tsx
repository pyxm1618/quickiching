
import type { Metadata } from "next";
import { alternateLanguages } from "@/i18n/helpers";
import Link from "next/link";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import type { LineValue } from "@/domain/casting/types";
import { InfoPageShell } from "@/components/info-pages/info-page-shell";
import { ChangingLinesPrimer } from "@/components/info-pages/info-diagrams";
import styles from "@/components/info-pages/info-pages.module.css";

export const metadata: Metadata = {
  title: "I Ching Changing Lines — How Moving Lines Work",
  description: "Learn what changing lines mean in an I Ching reading, why 6 and 9 move, and how moving lines produce a relating hexagram.",
  alternates: { canonical: "/guides/changing-lines", languages: alternateLanguages("guides-changing-lines") },
  openGraph: { title: "I Ching Changing Lines — How Moving Lines Work", description: "Understand moving lines and the relating hexagram in an I Ching reading.", url: "/guides/changing-lines", type: "article" },
};

const WORKED_EXAMPLE_LINES = [7, 8, 9, 7, 6, 8] as const;
const WORKED_EXAMPLE = buildHexagramResult({ lineValuesBottomUp: WORKED_EXAMPLE_LINES, method: "three_coin" });
const WORKED_PRIMARY = hexagramByNumber(WORKED_EXAMPLE.primaryHexagramNumber);
if (WORKED_EXAMPLE.relatingHexagramNumber === null) throw new Error("GUIDE_WORKED_EXAMPLE_REQUIRES_RELATING_HEXAGRAM");
const WORKED_RELATING = hexagramByNumber(WORKED_EXAMPLE.relatingHexagramNumber);

function lineMeaning(value: LineValue): string {
  if (value === 6) return "Old yin";
  if (value === 7) return "Young yang";
  if (value === 8) return "Young yin";
  return "Old yang";
}
function lineChange(value: LineValue): string {
  if (value === 6) return "Changing → yang";
  if (value === 9) return "Changing → yin";
  return "Stable";
}

export default function ChangingLinesGuidePage() {
  return (
    <InfoPageShell
      eyebrow="I Ching Guide"
      title="I Ching Changing Lines"
      lead="Changing lines, also called moving lines, identify the positions where a cast changes polarity when the relating hexagram is calculated. The line values are always read from the bottom of the hexagram upward."
    >
      <section className={styles.guideMain}>
        <h2 className={styles.paperHeading}>The four line values</h2>
        <ChangingLinesPrimer />
        <section className={styles.sectionBreak}>
          <h2 className={styles.paperHeading}>From moving lines to a relating hexagram</h2>
          <p className={styles.paperText}>First preserve the primary hexagram exactly as cast. Then reverse only the changing positions: 6 becomes yang and 9 becomes yin. The six resulting yin/yang positions map to the relating hexagram. Stable 7 and 8 lines keep their original polarity.</p>
        </section>
      </section>

      <section className={styles.guideSecondary}>
        <h2 className={styles.paperHeading}>Worked example: 7 / 8 / 9 / 7 / 6 / 8</h2>
        <p className={styles.paperText}>This sequence is shown in the same bottom-to-top order used by Quick I Ching’s casting domain. The example below is calculated by the project’s production hexagram function and King Wen mapping rather than by a separate guide-only lookup.</p>
        <table className={styles.dataTable}>
          <thead><tr><th>Position</th><th>Value</th><th>Primary line</th><th>What happens</th></tr></thead>
          <tbody>
            {WORKED_EXAMPLE.lineValuesBottomUp.map((value,index) => (
              <tr key={index}><td>Line {index+1}</td><td>{value}</td><td>{lineMeaning(value)}</td><td>{lineChange(value)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className={styles.callout}>
          <p><strong>Primary:</strong> Hexagram {WORKED_PRIMARY.number} — {WORKED_PRIMARY.englishName}</p>
          <p><strong>Changing positions:</strong> Lines {WORKED_EXAMPLE.movingLinePositions.join(" and ")}. Line 3 is old yang (9) and flips to yin; line 5 is old yin (6) and flips to yang.</p>
          <p><strong>Relating:</strong> Hexagram {WORKED_RELATING.number} — {WORKED_RELATING.englishName}. Every other position remains exactly as it was in the primary hexagram.</p>
        </div>

        <section className={styles.sectionBreak}>
          <h2 className={styles.paperHeading}>No, one, or multiple changing lines</h2>
          <div className={styles.paperText}>
            <p><strong>No changing lines:</strong> a cast containing only 7 and 8 has no moving positions, so Quick I Ching does not generate a separate relating hexagram.</p>
            <p><strong>One changing line:</strong> only that one position reverses. The other five lines stay unchanged when the relating hexagram is formed.</p>
            <p><strong>Multiple changing lines:</strong> every actual 6 or 9 reverses at the same time. Together those changed positions form the relating hexagram; stable positions do not move.</p>
          </div>
        </section>

        <section className={styles.sectionBreak}>
          <h2 className={styles.paperHeading}>Reading order</h2>
          <ol className={styles.paperOrdered}>
            <li><strong>Primary Hexagram:</strong> understand the original six-line pattern first.</li>
            <li><strong>Changing Lines:</strong> identify the actual moving positions and what they emphasize.</li>
            <li><strong>Relating Hexagram:</strong> compare the structure produced by those specific flips.</li>
            <li><strong>Reflection:</strong> bring the layers together without treating the relating figure as a guaranteed future.</li>
          </ol>
        </section>

        <section className={styles.sectionBreak}>
          <h2 className={styles.paperHeading}>How to read change responsibly</h2>
          <p className={styles.paperText}>I Ching changing lines show where the structure is not static. They can focus reflection on transition, tension, or a point that deserves attention. They do not prove that a specific event must occur, and a relating hexagram should not be treated as an unavoidable future state.</p>
        </section>

        <nav className={styles.relatedNav} aria-label="Related changing-line pages">
          <Link href="/guides/primary-relating-hexagrams">Primary &amp; relating hexagrams</Link>
          <Link href="/methods/three-coin">Three-coin method</Link>
          <Link href="/methods/yarrow-stalks">Yarrow stalk method</Link>
          <Link href="/">Start an I Ching reading</Link>
        </nav>
      </section>
    </InfoPageShell>
  );
}
