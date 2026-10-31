
"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { UserNavControl } from "@/components/auth/user-nav-control";
import { getDictionary } from "@/i18n/dictionaries";
import type { ContentLocale } from "@/i18n/config";
import styles from "./info-pages.module.css";

export function InfoPageHeader({ locale = "en", authEnabled = false }: {
  locale?: ContentLocale;
  authEnabled?: boolean;
}) {
  const dictionary = getDictionary(locale);
  const homeHref = locale === "zh-Hans" ? "/zh" : "/";
  return (
    <header className={styles.infoHeader}>
      <div className={styles.infoHeaderInner}>
        <Link href={homeHref} prefetch={false} className={styles.infoBrand}>
          <BrandMark size="md" priority locale={locale} />
          <span>Quick I Ching</span>
        </Link>
        <div className={styles.headerControls}>
          <LanguageSwitcher locale={locale} labels={dictionary.language} idPrefix="info-page" />
          {authEnabled ? <div className={styles.infoAuth}><UserNavControl locale={locale} /></div> : null}
        </div>
      </div>
    </header>
  );
}
