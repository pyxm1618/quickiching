"use client";

import React from "react";
import Link from "next/link";
import { Globe } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { UserNavControl } from "@/components/auth/user-nav-control";
import { SeoRouteGraph } from "@/components/seo-route-graph";
import { localeSwitchTarget, shellHomeTarget } from "@/navigation/locale-navigation";
import { useNavigationLocation } from "@/navigation/navigation-location";
import { HEXAGRAMS_LINK, INFO_LINKS, OTHER_METHOD_LINKS, type DiscoveryLink } from "@/navigation/discovery-links";
import type { ContentLocale } from "@/i18n/config";
import type { SurfaceContract } from "@/navigation/surface-contract";
import styles from "./content-navigation-shell.module.css";

/**
 * Shell-owned Content presentation for S04 (Hexagram Detail).
 *
 * It is a presentation of the single global navigation shell — SiteHeader is
 * the only owner and the only component that selects it. It renders in normal
 * document flow, so it reserves its own band instead of floating over the
 * approved detail scroll, its section navigation, or its local auxiliary links.
 *
 * Capabilities are identical at desktop and mobile: Home, semantic locale
 * switching, Account (when capability-enabled) and discovery navigation.
 * The three discovery groups deliberately avoid creating a /methods or /info
 * hub: they expose the real indexable destinations directly.
 */
export function ContentNavigationShell({
  locale = "en",
  authEnabled = false,
  contract,
}: {
  locale?: ContentLocale;
  authEnabled?: boolean;
  contract: SurfaceContract;
}) {
  const zh = locale === "zh-Hans";
  const location = useNavigationLocation();
  const target = localeSwitchTarget({
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    currentLocale: locale,
  });
  const localize = (path: string) => zh ? `/zh${path === "/" ? "" : path}` : path;
  const label = (link: DiscoveryLink) => zh ? link.zh : link.en;
  const homeHref = shellHomeTarget(locale);

  return (
    <header
      className={styles.shell}
      data-navigation-surface={contract.id}
      data-navigation-mode={contract.mode}
      data-shell-layout={contract.layout}
      data-primary-navigation={contract.primaryNavigation ? "yes" : "no"}
      aria-label={zh ? "主导航" : "Main navigation"}
    >
      <div className={styles.bar}>
        {contract.homeControl ? (
          <Link href={homeHref} prefetch={false} className={styles.brand} data-shell-home>
            <BrandMark size="md" priority locale={locale} />
            <span>Quick I Ching</span>
          </Link>
        ) : null}

        <div className={styles.controls}>
          {contract.localeControl ? (
            <nav className={styles.languages} data-language-switcher aria-label={zh ? "选择语言" : "Select language"}>
              <Globe aria-hidden="true" />
              {zh
                ? <Link href={target.href} prefetch={false} hrefLang="en" lang="en" data-locale-target>EN</Link>
                : <span lang="en" aria-current="page">EN</span>}
              <span aria-hidden="true">/</span>
              {zh
                ? <span lang="zh-Hans" aria-current="page">中文</span>
                : <Link href={target.href} prefetch={false} hrefLang="zh-Hans" lang="zh-Hans" data-locale-target>中文</Link>}
            </nav>
          ) : null}
          {contract.accountControl && authEnabled ? (
            <div className={styles.account} data-shell-account>
              <UserNavControl locale={locale} />
            </div>
          ) : null}
        </div>
      </div>

      {contract.primaryNavigation ? (
        <nav className={styles.primary} data-primary-navigation aria-label={zh ? "探索易经" : "Explore the I Ching"}>
          <Link href={localize(HEXAGRAMS_LINK.path)} prefetch={false} className={styles.primaryLink} data-primary-hexagrams>
            {label(HEXAGRAMS_LINK)}
          </Link>
          <details className={styles.group}>
            <summary data-primary-group="methods">{zh ? "其他起卦" : "Other Methods"}</summary>
            <div className={styles.groupLinks}>
              {OTHER_METHOD_LINKS.map((link) => (
                <Link key={link.path} href={localize(link.path)} prefetch={false} className={styles.primaryLink}>{label(link)}</Link>
              ))}
            </div>
          </details>
          <details className={styles.group}>
            <summary data-primary-group="info">{zh ? "资讯" : "Info"}</summary>
            <div className={styles.groupLinks}>
              {INFO_LINKS.map((link) => (
                <Link key={link.path} href={localize(link.path)} prefetch={false} className={styles.primaryLink}>{label(link)}</Link>
              ))}
            </div>
          </details>
        </nav>
      ) : null}

      <SeoRouteGraph locale={locale} />
    </header>
  );
}
