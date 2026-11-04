import type { Metadata } from "next";
import Link from "next/link";
import { MeiHuaNumberFlow } from "@/components/public-reading/mei-hua-number-flow";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";
import { EN_MEI_HUA_CONTENT } from "@/content/mei-hua-yi-shu/en";
import styles from "@/app/method-seo-shell.module.css";

const CONTENT = EN_MEI_HUA_CONTENT;
export const metadata: Metadata = {
  title: CONTENT.metadata.title,
  description: CONTENT.metadata.description,
  alternates: { canonical: canonicalUrl("/methods/mei-hua-yi-shu"), languages: alternateLanguages("mei-hua-yi-shu") },
  openGraph: { title: CONTENT.metadata.title, description: "Cast a Plum Blossom I Ching hexagram from one chosen number and the confirmed local moment using the documented object-number rule.", url: canonicalUrl("/methods/mei-hua-yi-shu"), type: "website" },
};

export default function MeiHuaPage() {
  return <>
    <MeiHuaNumberFlow />
    <article className={styles.methodPage}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>{CONTENT.eyebrow}</p>
        <h2 className={styles.title}>{CONTENT.h1}</h2>
        <p className={styles.lead}>{CONTENT.introduction}</p>
      </header>



      <section className={styles.readingGrid}>
        <div className={styles.folio}><h2 className={styles.sectionTitle}>Number + moment casting</h2><p className={styles.bodyText}>This flow records one question, the number you choose, and the exact moment you confirm the cast. Those inputs are sealed together before any result can be shown.</p><p className={styles.bodyText}>This flow follows the classical object-number rule: your chosen number forms the upper trigram, the local Earthly-Branch hour number forms the lower trigram, and their sum selects the changing line.</p></div>
        <div className={styles.folio}><h2 className={styles.sectionTitle}>What is locked at confirmation</h2><ul className={styles.bulletList}><li><strong>Question:</strong> the core question entered before choosing a number.</li><li><strong>Number:</strong> the confirmed integer chosen for this cast.</li><li><strong>Time:</strong> the exact UTC instant when Confirm &amp; Cast is clicked.</li><li><strong>Timezone:</strong> the browser-resolved IANA timezone used to display the local moment.</li></ul></div>
      </section>

      <section className={styles.readingSection}>
        <h2 className={styles.sectionTitle}>How to interpret the result</h2><p className={styles.bodyText}>The confirmed number and moment produce one deterministic primary hexagram, one changing line, and the relating hexagram, then continue through the same shared Reading structure used by the other casting methods.</p>
        <nav className={styles.relatedNav} aria-label="Related Mei Hua guides"><Link href="/hexagrams" className={styles.relatedLink}>64 Hexagrams hub</Link><Link href="/guides/changing-lines" className={styles.relatedLink}>Changing lines</Link><Link href="/" className={styles.relatedLink}>I Ching online home</Link></nav>
      </section>
    </article>
  </>;
}
