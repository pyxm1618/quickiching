"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import styles from "./error.module.css";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const COPY = {
  en: {
    title: "Something Went Wrong",
    description: "We couldn't complete this page. You can try again or return to the home page.",
    retry: "Try Again",
    home: "Return Home",
    homeHref: "/",
  },
  zh: {
    title: "页面出了点问题",
    description: "我们无法完成此页面。你可以重试，或返回首页。",
    retry: "重试",
    home: "返回首页",
    homeHref: "/zh",
  },
} as const;

const TRIGRAMS = ["☷", "☴", "☵", "☶", "☰", "☱", "☲", "☳"] as const;

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  void error;

  const pathname = usePathname();
  const locale = pathname === "/zh" || pathname?.startsWith("/zh/") ? "zh" : "en";
  const copy = COPY[locale];

  return (
    <main className={`${styles.screen} ${locale === "zh" ? styles.zh : ""}`}>
      <section className={styles.content} aria-labelledby="quick-iching-error-title">
        <div className={styles.emblem} aria-hidden="true">
          <div className={styles.trigrams}>
            {TRIGRAMS.map((mark, index) => (
              <span
                key={mark}
                className={`${styles.trigram} ${styles[`trigram${index}`]}`}
              >
                {mark}
              </span>
            ))}
          </div>

          <Image
            src="/hexagram-detail/delivery/taiji-290.avif"
            alt=""
            width={176}
            height={176}
            priority
            unoptimized
            className={styles.taiji}
          />
        </div>

        <div className={styles.titleRow}>
          <span className={styles.titleRule} aria-hidden="true" />
          <h1 id="quick-iching-error-title" className={styles.title}>
            {copy.title}
          </h1>
          <span className={styles.titleRule} aria-hidden="true" />
        </div>

        <p className={styles.description}>{copy.description}</p>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={reset}
          >
            {copy.retry}
          </button>

          <a className={`${styles.button} ${styles.secondaryButton}`} href={copy.homeHref}>
            {copy.home}
          </a>
        </div>
      </section>
    </main>
  );
}
