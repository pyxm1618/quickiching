import Image from "next/image";
import Link from "next/link";
import { Home } from "lucide-react";
import { GildedTitle } from "@/components/typography/gilded-title";
import styles from "./quick-iching-not-found.module.css";

type NotFoundLocale = "en" | "zh";

type NotFoundCopy = {
  title: string;
  firstLine: string;
  secondLine: string;
  homeLabel: string;
  homeHref: string;
  hexagramsLabel: string;
  hexagramsHref: string;
};

const COPY: Record<NotFoundLocale, NotFoundCopy> = {
  en: {
    title: "This Path Has No Hexagram",
    firstLine: "The page you’re looking for does not exist or may have moved.",
    secondLine: "Return to Quick I Ching and begin a new reading.",
    homeLabel: "Return Home",
    homeHref: "/",
    hexagramsLabel: "Explore the 64 Hexagrams",
    hexagramsHref: "/hexagrams",
  },
  zh: {
    title: "此处无卦",
    firstLine: "你访问的页面不存在，或已经移动。",
    secondLine: "返回 Quick I Ching，重新开始一次起卦。",
    homeLabel: "返回首页",
    homeHref: "/zh",
    hexagramsLabel: "浏览六十四卦",
    hexagramsHref: "/zh/hexagrams",
  },
};

function TrigramMark({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export function QuickIChingNotFound({ locale }: { locale: NotFoundLocale }) {
  const copy = COPY[locale];
  const titleId = `quick-iching-404-title-${locale}`;

  return (
    <section
      className={`${styles.page} ${locale === "zh" ? styles.zh : ""}`}
      aria-labelledby={titleId}
    >
      <div className={styles.canvas}>
        <Image
          className={styles.background}
          src="/404/quick-iching-404-background.avif"
          alt=""
          fill
          priority
          sizes="100vw"
        />

        <div className={styles.taiji} aria-hidden="true">
          <Image
            src="/404/quick-iching-404-taiji.avif"
            alt=""
            fill
            sizes="(max-width: 640px) 84vw, 37vw"
          />
        </div>

        <div className={styles.content}>
          <p className={styles.code}>404</p>
          <GildedTitle id={titleId} size="inherit" className={styles.title}>
            {copy.title}
          </GildedTitle>

          <div className={styles.divider} aria-hidden="true">
            <span className={styles.dividerLine} />
            <TrigramMark className={styles.dividerMark} />
            <span className={styles.dividerLine} />
          </div>

          <p className={styles.description}>
            <span>{copy.firstLine}</span>
            <span>{copy.secondLine}</span>
          </p>

          <div className={styles.actions}>
            <Link className={`${styles.button} ${styles.primaryButton}`} href={copy.homeHref}>
              <Home className={styles.homeIcon} aria-hidden="true" strokeWidth={2.35} />
              <span>{copy.homeLabel}</span>
            </Link>
            <Link className={`${styles.button} ${styles.secondaryButton}`} href={copy.hexagramsHref}>
              <TrigramMark className={styles.buttonMark} />
              <span>{copy.hexagramsLabel}</span>
            </Link>
          </div>
        </div>

        <div className={styles.atmosphere} aria-hidden="true">
          <Image
            src="/404/quick-iching-404-atmosphere.avif"
            alt=""
            fill
            sizes="(max-width: 640px) 170vw, 84vw"
          />
        </div>

        <div className={styles.coins} aria-hidden="true">
          <Image
            src="/404/quick-iching-404-coins.avif"
            alt=""
            fill
            sizes="(max-width: 640px) 88vw, 33vw"
          />
        </div>
      </div>
    </section>
  );
}
