
"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { usePathname } from "next/navigation";
import { currentRouteForPath, languageSwitchTarget } from "@/i18n/helpers";
import { Globe } from "lucide-react";
import { UserNavControl } from "@/components/auth/user-nav-control";
import type { ContentLocale } from "@/i18n/config";
import styles from "./info-pages.module.css";

export function InfoPageHeader({ locale = "en", authEnabled = false }: {
  locale?: ContentLocale;
  authEnabled?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const route = currentRouteForPath(pathname);
  const target = route ? languageSwitchTarget(route.id, locale) : { href: locale === "en" ? "/zh" : "/" };
  const homeHref = locale === "zh-Hans" ? "/zh" : "/";
  return (
    <header className={styles.infoHeader}>
      <div className={styles.infoHeaderInner}>
        <Link href={homeHref} prefetch={false} className={styles.infoBrand}>
          <BrandMark size="md" priority locale={locale} />
          <span>Quick I Ching</span>
        </Link>
        <div className={styles.headerControls}>
          <nav className={styles.headerLanguages} aria-label="Language">
            <Globe aria-hidden="true" />
            <Link href={locale === "en" ? pathname : target.href} lang="en" aria-current={locale === "en" ? "page" : undefined}>EN</Link>
            <span>/</span>
            <Link href={locale === "zh-Hans" ? pathname : target.href} lang="zh-Hans" aria-current={locale === "zh-Hans" ? "page" : undefined}>中文</Link>
          </nav>
          <span className={styles.headerSeparator} aria-hidden="true">|</span>
          {authEnabled ? <div className={styles.infoAuth}>
            <UserNavControl locale={locale} />
          </div> : <Link className={styles.signIn} href={`${locale === "zh-Hans" ? "/zh" : ""}/signin?callbackURL=${encodeURIComponent(pathname)}`}>{locale === "en" ? "Sign In" : "登录"}</Link>}
        </div>
      </div>
    </header>
  );
}
