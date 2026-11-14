"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { localeSwitchTarget, shellHomeTarget } from "@/navigation/locale-navigation";
import { surfaceContract, type SurfaceContract } from "@/navigation/surface-contract";
import { Globe } from "lucide-react";
import { UserNavControl } from "@/components/auth/user-nav-control";
import type { ContentLocale } from "@/i18n/config";
import styles from "./info-pages.module.css";

/**
 * Content-page shell presentation (Guides / Help / Legal).
 *
 * It is one of the two shell presentations, not a page-owned navigation: the
 * shell picks it from the Surface Contract and it renders only the capabilities
 * that contract authorizes (no discovery navigation on these surfaces).
 */
export function InfoPageHeader({
  locale = "en",
  authEnabled = false,
  contract = surfaceContract("S09"),
}: {
  locale?: ContentLocale;
  authEnabled?: boolean;
  contract?: SurfaceContract;
}) {
  const pathname = usePathname() ?? "/";
  const [hash, setHash] = useState("");
  useEffect(() => {
    setHash(window.location.hash);
  }, [pathname]);

  const target = localeSwitchTarget({ pathname, hash, currentLocale: locale });
  const homeHref = shellHomeTarget(locale);
  const languageLabel = locale === "zh-Hans" ? "语言" : "Language";
  const englishLabel = locale === "zh-Hans" ? "英文" : "EN";

  return (
    <header
      className={styles.infoHeader}
      data-navigation-surface={contract.id}
      data-navigation-mode={contract.mode}
      data-shell-layout={contract.layout}
    >
      <div className={styles.infoHeaderInner}>
        <Link href={homeHref} prefetch={false} className={styles.infoBrand} data-shell-home>
          <BrandMark size="md" priority locale={locale} />
          <span>Quick I Ching</span>
        </Link>
        <div className={styles.headerControls}>
          <nav className={styles.headerLanguages} aria-label={languageLabel} data-language-switcher>
            <Globe aria-hidden="true" />
            {locale === "zh-Hans"
              ? <Link href={target.href} prefetch={false} hrefLang="en" lang="en">{englishLabel}</Link>
              : <span lang="en" aria-current="page">{englishLabel}</span>}
            <span>/</span>
            {locale === "zh-Hans"
              ? <span lang="zh-Hans" aria-current="page">中文</span>
              : <Link href={target.href} prefetch={false} hrefLang="zh-Hans" lang="zh-Hans">中文</Link>}
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
