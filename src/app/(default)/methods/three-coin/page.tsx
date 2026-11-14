import type { Metadata } from "next";
import { alternateLanguages } from "@/i18n/helpers";
import Link from "next/link";
import styles from "@/app/method-seo-shell.module.css";
import { GildedTitle } from "@/components/typography/gilded-title";

export const metadata: Metadata = {
  title: "I Ching Three-Coin Method — Free Online Cast",
  description: "Use the I Ching three-coin method online. Toss six lines from bottom to top, identify changing lines, and read the primary and relating hexagrams for free.",
  alternates: { canonical: "/methods/three-coin", languages: alternateLanguages("three-coin-method") },
  openGraph: { title: "I Ching Three-Coin Method — Free Online Cast", description: "Cast a complete free three-coin I Ching reading online.", url: "/methods/three-coin", type: "website" },
};

export default function ThreeCoinMethodPage() {
  return (
    <article className={styles.methodPage}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>I Ching Coin · Three Coin Method</p>
        <GildedTitle size="lg" className={styles.title}>I Ching Three-Coin Method</GildedTitle>
        <p className={styles.lead}>The three-coin I Ching method turns six coin tosses into a hexagram. Each completed toss is one line, built from the bottom upward; values 6 and 9 are changing lines.</p>
      </header>

      {/* SEO Method Detail, not a product entry: the canonical three-coin
          product runs on the localized root and nowhere else. */}
      <section className={styles.toolStage}>
        <div className={styles.entryPanel} data-three-coin-canonical-entry>
          <p>The three-coin cast itself runs on the Quick I Ching home page, where the question, the six casts and the sealed result stay in one flow. This page explains the method; it does not run a second copy of the product.</p>
          <Link href="/" prefetch={false} className={styles.entryCta} data-three-coin-entry-cta>Cast with the three-coin method</Link>
        </div>
      </section>

      <section className={styles.readingGrid}>
        <div className={styles.folio}><h2 className={styles.sectionTitle}>How the coin method works</h2><ol className={styles.orderedList}><li>Three independent coin faces are generated with browser Web Crypto.</li><li>Yang/head contributes 3 and yin/tail contributes 2.</li><li>The total becomes 6, 7, 8, or 9.</li><li>Repeat six times, with the first result as the bottom line.</li><li>6 and 9 move; reversing those lines derives the relating hexagram.</li></ol></div>
        <div className={styles.folio}><h2 className={styles.sectionTitle}>What you get</h2><p className={styles.bodyText}>The free result includes the full six-line figure, primary hexagram number and name, changing-line positions, a relating hexagram when one exists, and an original basic interpretation of the hexagram themes. It does not require sign-in, payment, or AI.</p><p className={styles.bodyText}>A generated line cannot be edited. Use <strong>New reading</strong> only when you intentionally want to discard the entire browser-session reading and start again.</p></div>
      </section>

      <section className={styles.readingSection}>
        <h2 className={styles.sectionTitle}>Understanding a three-coin reading</h2>
        <p className={styles.bodyText}>Start with the primary hexagram as the main pattern. If moving lines appear, note where change occurs before looking at the relating hexagram. The relating figure is a second structural reference, not a guaranteed outcome.</p>
        <nav className={styles.relatedNav} aria-label="Related three-coin guides"><Link href="/guides/changing-lines" className={styles.relatedLink}>Changing lines</Link><Link href="/guides/primary-relating-hexagrams" className={styles.relatedLink}>Primary & relating hexagrams</Link><Link href="/guides/how-to-ask-the-i-ching" className={styles.relatedLink}>How to ask the I Ching</Link><Link href="/methods/yarrow-stalks" className={styles.relatedLink}>Compare the yarrow method</Link></nav>
      </section>
    </article>
  );
}
