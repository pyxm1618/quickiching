
import type { Metadata } from "next";
import { alternateLanguages } from "@/i18n/helpers";
import Link from "next/link";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import { InfoPageShell } from "@/components/info-pages/info-page-shell";
import { PrimaryRelatingPrimer } from "@/components/info-pages/info-diagrams";
import styles from "@/components/info-pages/info-pages.module.css";

export const metadata: Metadata = {
  title: "Primary and Relating Hexagrams — I Ching Reading Guide",
  description: "Understand the difference between a primary hexagram, changing lines, and a relating hexagram in an I Ching reading.",
  alternates: { canonical: "/guides/primary-relating-hexagrams", languages: alternateLanguages("guides-primary-relating") },
  openGraph: { title: "Primary and Relating Hexagrams — I Ching Reading Guide", description: "Learn how primary and relating hexagrams connect through changing lines.", url: "/guides/primary-relating-hexagrams", type: "article" },
};

const STRUCTURE_EXAMPLE = buildHexagramResult({ lineValuesBottomUp: [7, 8, 9, 7, 6, 8], method: "three_coin" });
const STRUCTURE_PRIMARY = hexagramByNumber(STRUCTURE_EXAMPLE.primaryHexagramNumber);
if (STRUCTURE_EXAMPLE.relatingHexagramNumber === null) throw new Error("GUIDE_STRUCTURE_EXAMPLE_REQUIRES_RELATING_HEXAGRAM");
const STRUCTURE_RELATING = hexagramByNumber(STRUCTURE_EXAMPLE.relatingHexagramNumber);

export default function PrimaryRelatingGuidePage() {
  return (
    <InfoPageShell
      eyebrow="I Ching Guide"
      title="Primary and Relating Hexagrams"
      lead="Primary and relating hexagrams are two structures connected by the changing lines in one cast. The primary hexagram is always present; a separate relating hexagram exists only when at least one line actually changes."
    >
      <section className={styles.guideMain}>
        <div className={styles.primaryIntroGrid}>
          <section><h2 className={styles.paperSubheading}>Primary hexagram: the original structure</h2><p className={styles.paperText}>The primary hexagram is the six-line yin/yang pattern exactly as it was cast, before any moving line is reversed. It is the reading’s starting structure and should be understood first rather than treated as a temporary result that is immediately replaced.</p></section>
          <section><h2 className={styles.paperSubheading}>Changing lines: the connection between the two</h2><p className={styles.paperText}>Changing lines identify the exact positions where the primary structure transforms. Old yin (6) changes to yang; old yang (9) changes to yin. Stable values 7 and 8 stay as they are. These actual moving positions—not a second random cast—are what connect the primary and relating hexagrams.</p></section>
          <section><h2 className={styles.paperSubheading}>Relating hexagram: the structure after the actual flips</h2><p className={styles.paperText}>The relating hexagram is produced by reversing every changing position and preserving every stable position. It gives a second structural perspective on the movement contained in the original cast. Quick I Ching does not present an I Ching relating hexagram as a fixed or guaranteed future state.</p></section>
        </div>
        <PrimaryRelatingPrimer />
      </section>

      <section className={styles.guideSecondary}>
        <h2 className={styles.paperHeading}>Structure example</h2>
        <p className={styles.paperText}>Using the bottom-to-top line values <strong>7 / 8 / 9 / 7 / 6 / 8</strong>, the project’s production domain calculation produces this relationship:</p>
        <div className={styles.questionGrid}>
          <section className={styles.exampleCard}><h3>Primary</h3><p><strong>Hexagram {STRUCTURE_PRIMARY.number} — {STRUCTURE_PRIMARY.englishName}</strong></p><p>This is the original six-line pattern before any moving position is flipped.</p></section>
          <section className={styles.exampleCard}><h3>Changing positions</h3><p><strong>Lines {STRUCTURE_EXAMPLE.movingLinePositions.join(" and ")}</strong></p><p>Only these actual moving lines reverse. The remaining four positions retain their primary polarity.</p></section>
          <section className={styles.exampleCard}><h3>Relating</h3><p><strong>Hexagram {STRUCTURE_RELATING.number} — {STRUCTURE_RELATING.englishName}</strong></p><p>This second structure comes from those specific flips; it is not independently generated.</p></section>
        </div>

        <section className={styles.sectionBreak}><h2 className={styles.paperHeading}>When there are no changing lines</h2><p className={styles.paperText}>A cast made only of 7 and 8 contains no moving lines. In that case the primary hexagram stands on its own. Quick I Ching does not invent a second hexagram just to make the result look more complete.</p></section>
        <section className={styles.sectionBreak}>
          <h2 className={styles.paperHeading}>A practical reading order</h2>
          <ol className={styles.paperOrdered}>
            <li><strong>Primary Hexagram:</strong> observe the original pattern as a whole.</li>
            <li><strong>Changing Lines:</strong> locate the moving positions and consider what they emphasize.</li>
            <li><strong>Relating Hexagram:</strong> if present, compare the structure created by those exact changes.</li>
            <li><strong>Reflection:</strong> bring the layers together while keeping real-world evidence and your own judgment in charge.</li>
          </ol>
        </section>
        <nav className={styles.relatedNav} aria-label="Related hexagram guides">
          <Link href="/guides/changing-lines">Changing lines</Link><Link href="/hexagrams">64 Hexagrams hub</Link><Link href="/methods/three-coin">Three-coin method</Link><Link href="/">Cast an I Ching reading</Link>
        </nav>
      </section>
    </InfoPageShell>
  );
}
