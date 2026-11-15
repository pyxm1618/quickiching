
"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { useLocaleSwitch } from "@/lib/browser-navigation";
import { Globe } from "lucide-react";
import { UserNavControl } from "@/components/auth/user-nav-control";
import type { ContentLocale } from "@/i18n/config";
import styles from "./info-pages.module.css";

export function InfoPageHeader({ locale = "en", authEnabled = false }: {
  locale?: ContentLocale;
  authEnabled?: boolean;
}) {
  // C5: the shared browser-navigation owner — one locale-switch implementation,
  // full outer location + nested context preserved. The current-locale label is
  // a non-navigation indicator and must never act as Home (locale semantics only).
  const localeSwitch = useLocaleSwitch(locale === "en" ? "zh-Hans" : "en");
  const homeHref = locale === "zh-Hans" ? "/zh" : "/";
  const languageLabel = locale === "zh-Hans" ? "语言" : "Language";
  return (
    <header className={styles.infoHeader}>
      <div className={styles.infoHeaderInner}>
        <Link href={homeHref} prefetch={false} className={styles.infoBrand}>
          <BrandMark size="md" priority locale={locale} />
          <span>Quick I Ching</span>
        </Link>
        <div className={styles.headerControls}>
          <nav className={styles.headerLanguages} aria-label={languageLabel} data-language-switcher>
            <Globe aria-hidden="true" />
            {locale === "en" ? (
              <span aria-current="page" lang="en" data-locale-current="en">EN</span>
            ) : (
              <Link href={localeSwitch.href} prefetch={false} hrefLang="en" lang="en" data-locale-switch="en" onClick={localeSwitch.onClick}>英文</Link>
            )}
            <span>/</span>
            {locale === "zh-Hans" ? (
              <span aria-current="page" lang="zh-Hans" data-locale-current="zh-Hans">中文</span>
            ) : (
              <Link href={localeSwitch.href} prefetch={false} hrefLang="zh-Hans" lang="zh-Hans" data-locale-switch="zh-Hans" onClick={localeSwitch.onClick}>中文</Link>
            )}
          </nav>
          {authEnabled ? <>
            <span className={styles.headerSeparator} aria-hidden="true">|</span>
            <div className={styles.infoAuth}>
              <UserNavControl locale={locale} />
            </div>
          </> : null}
        </div>
      </div>
    </header>
  );
}
