
import type { Metadata } from "next";
import { alternateLanguages } from "@/i18n/helpers";
import Link from "next/link";
import { InfoPageShell } from "@/components/info-pages/info-page-shell";
import { BookOpen, UserRound, Layers3 } from "lucide-react";
import { PaperArtwork, GuideDecoration } from "@/components/info-pages/paper-artwork";
import styles from "@/components/info-pages/info-pages.module.css";

export const metadata: Metadata = {
  title: "Help & Support",
  description: "Help for Quick I Ching Public V1 casting methods and browser-session readings.",
  alternates: { canonical: "/help", languages: alternateLanguages("help") },
  robots: { index: false, follow: true },
};

export default function HelpPage() {
  return (
    <InfoPageShell variant="help" title="Help" lead={<>
      <strong>Need help using Quick I Ching?</strong>
      <span>Find answers to the most common questions about casting, readings, accounts, and Deep Reading.</span>
    </>}>
      <section className={styles.helpPanel}>
        <div className={styles.helpRow}>
          <PaperArtwork kind="helpTop" />
          <section className={styles.helpGroup}>
            <PaperArtwork kind="legal" />
            <h2>
              <span className={styles.helpIcon} aria-hidden="true">
                <GuideDecoration kind="coins" />
              </span>
              <span>Getting Started</span>
            </h2>
            <section className={styles.helpQuestion}>
              <h3>Why does Mei Hua ask for a timezone?</h3>
              <p>The current-time convention needs a local civil date and hour branch. Your IANA timezone tells the browser which local date, hour, and daylight-saving offset apply to the fixed casting instant.</p>
            </section>
          </section>
          <section className={styles.helpGroup}>
            <PaperArtwork kind="legal" />
            <h2>
              <span className={styles.helpIcon} aria-hidden="true">
                <Layers3 />
              </span>
              <span>Understanding Your Reading</span>
            </h2>
            <section className={styles.helpQuestion}>
              <h3>Are the four readings really free?</h3>
              <p>Yes. Three Coin, Yarrow Stalk, Mei Hua Yi Shu current-time casting, and Manual Cast each end with the primary hexagram, changing lines, relating hexagram when present, and a general static interpretation. No sign-in or payment is required.</p>
            </section>
            <div className={styles.helpQuestion}>
              <p>For reading concepts, see <Link href="/guides/changing-lines">Changing Lines</Link> and <Link href="/guides/primary-relating-hexagrams">Primary &amp; Relating Hexagrams</Link>.</p>
            </div>
          </section>
        </div>
        <div className={styles.helpRow}>
          <PaperArtwork kind="helpBottom" />
          <section className={styles.helpGroup}>
            <PaperArtwork kind="legal" />
            <h2>
              <span className={styles.helpIcon} aria-hidden="true">
                <UserRound />
              </span>
              <span>Account &amp; Readings</span>
            </h2>
            <section className={styles.helpQuestion}>
              <h3>Where is my reading saved?</h3>
              <p>The current reading or an in-progress ritual may use browser <code>sessionStorage</code> so it can recover after a refresh. Signed-in Three-Coin readings that complete the formal account save flow appear in My Readings. There is no separate browser-only reading history product.</p>
            </section>
          </section>
          <section className={styles.helpGroup}>
            <PaperArtwork kind="legal" />
            <h2>
              <span className={styles.helpIcon} aria-hidden="true">
                <BookOpen />
              </span>
              <span>Deep Reading</span>
            </h2>
            <section className={styles.helpQuestion}>
              <h3>Can I get a reading for my specific situation?</h3>
              <p>The complete free reading explains the cast itself and never calls AI. Deep Reading is offered only when Pricing shows it is available, and supports Three-Coin, Yarrow Stalk, and Mei Hua Yi Shu casts. It requires sign-in, a clear core question set before the first toss, enough situation context, and one credit. It connects that frozen question and your context with the exact cast, its actual changing lines and relating hexagram when present, and cited Quick I Ching source material. If you skipped the question, that cast remains free-only; start a new cast to use Deep Reading. High-risk medical, legal, investment, or urgent safety requests are blocked before generation. A delivered report is saved with the account reading and remains available through My Readings.</p>
            </section>
            <section className={styles.helpQuestion}>
              <h3>How do credit packs and refunds work?</h3>
              <p>Checkout requires sign-in and shows the price, validity, and applicable refund terms before payment. One credit is reserved when an eligible Deep Reading starts; successful delivery consumes it. If generation or review fails after reservation, the credit is released. A request blocked before generation does not create a paid reading job.</p>
            </section>
          </section>
        </div>
        <div className={styles.helpSupport}>
          <PaperArtwork kind="secondary" />
          <h2>Still need help?</h2>
          <p>Email <a href="mailto:support@quickiching.com">support@quickiching.com</a>.</p>
          <Link href="/">Start a Reading</Link>
        </div>
      </section>
    </InfoPageShell>
  );
}
