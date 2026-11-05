"use client";

import { useEffect, useState } from "react";
import styles from "./global-error.module.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const COPY = {
  en: {
    title: "Quick I Ching Encountered a Problem",
    description:
      "The application couldn't continue. Try reloading the page, or return to the home page.",
    reload: "Reload",
    home: "Return Home",
    homeHref: "/",
  },
  zh: {
    title: "Quick I Ching 遇到了问题",
    description: "应用无法继续运行。你可以重新加载页面，或返回首页。",
    reload: "重新加载",
    home: "返回首页",
    homeHref: "/zh",
  },
} as const;

type Locale = keyof typeof COPY;

function readLocaleFromBrowser(): Locale {
  try {
    const pathname = window.location.pathname;
    return pathname === "/zh" || pathname.startsWith("/zh/") ? "zh" : "en";
  } catch {
    return "en";
  }
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  void error;
  void reset;

  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    setLocale(readLocaleFromBrowser());
  }, []);

  const copy = COPY[locale];

  const reloadPage = () => {
    window.location.reload();
  };

  return (
    <html lang={locale} className={styles.document}>
      <body className={`${styles.body} ${locale === "zh" ? styles.zh : ""}`}>
        <main className={styles.screen}>
          <section
            className={styles.content}
            aria-labelledby="quick-iching-global-error-title"
          >
            <div className={styles.emblem} aria-hidden="true">
              <img
                className={styles.taiji}
                src="/hexagram-detail/delivery/taiji-290.avif"
                alt=""
                width="156"
                height="156"
                aria-hidden="true"
              />
            </div>

            <h1 id="quick-iching-global-error-title" className={styles.title}>
              {copy.title}
            </h1>

            <p className={styles.description}>{copy.description}</p>

            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.button} ${styles.primaryButton}`}
                onClick={reloadPage}
              >
                {copy.reload}
              </button>

              <a
                className={`${styles.button} ${styles.secondaryButton}`}
                href={copy.homeHref}
              >
                {copy.home}
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
