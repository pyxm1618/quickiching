
import type { Metadata } from "next";
import Link from "next/link";
import { InfoPageShell } from "@/components/info-pages/info-page-shell";
import styles from "@/components/info-pages/info-pages.module.css";

export const metadata: Metadata = {
  title: "Help & Support",
  description: "Help for Quick I Ching Public V1 casting methods and browser-session readings.",
  alternates: { canonical: "/help" },
  robots: { index: false, follow: true },
};

export default function HelpPage() {
  return (
    <InfoPageShell eyebrow="Support" title="Help & Support">
      <section className={styles.helpPanel}>
        <div className={styles.helpGrid}>
          <section className={styles.helpCard}><h2>Are the four readings really free?</h2><p>Yes. Three Coin, Yarrow Stalk, Mei Hua Yi Shu current-time casting, and Manual Cast each end with the primary hexagram, changing lines, relating hexagram when present, and a general static interpretation. No sign-in or payment is required.</p></section>
          <section className={styles.helpCard}><h2>Where is my reading saved?</h2><p>Public V1 uses browser <code>sessionStorage</code> for the current reading or in-progress ritual. If you choose Save reading, the History page stores a maximum of 50 records in this browser’s <code>localStorage</code>; it is not a cloud account history. Clearing site/session data removes local records.</p></section>
          <section className={styles.helpCard}><h2>Why does Mei Hua ask for a timezone?</h2><p>The current-time convention needs a local civil date and hour branch. Your IANA timezone tells the browser which local date, hour, and daylight-saving offset apply to the fixed casting instant.</p></section>
          <section className={styles.helpCard}><h2>Can I get a reading for my specific situation?</h2><p>The complete free reading explains the cast itself and never calls AI. Deep Reading is offered only when Pricing shows it is available, and supports Three-Coin, Yarrow Stalk, and Mei Hua Yi Shu casts. It requires sign-in, a clear core question set before the first toss, enough situation context, and one credit. It connects that frozen question and your context with the exact cast, its actual changing lines and relating hexagram when present, and cited Quick I Ching source material. If you skipped the question, that cast remains free-only; start a new cast to use Deep Reading. High-risk medical, legal, investment, or urgent safety requests are blocked before generation. A delivered report is saved in account history.</p></section>
          <section className={styles.helpCard}><h2>How do credit packs and refunds work?</h2><p>Checkout requires sign-in and shows the price, validity, and applicable refund terms before payment. One credit is reserved when an eligible Deep Reading starts; successful delivery consumes it. If generation or review fails after reservation, the credit is released. A request blocked before generation does not create a paid reading job.</p></section>
          <section className={styles.helpCard}><h2>Need more help?</h2><p>Email <a href="mailto:support@quickiching.com">support@quickiching.com</a>. For reading concepts, see <Link href="/guides/changing-lines">Changing Lines</Link> and <Link href="/guides/primary-relating-hexagrams">Primary &amp; Relating Hexagrams</Link>.</p></section>
        </div>
      </section>
    </InfoPageShell>
  );
}
