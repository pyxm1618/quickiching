"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { currentRouteForPath, languageSwitchTarget } from "@/i18n/helpers";
import type { ContentLocale } from "@/i18n/config";

type LanguageLabels = {
  switchToChinese: string;
  switchToEnglish: string;
  chineseHome: string;
};

export function LanguageSwitcher({ locale, labels }: { locale: ContentLocale; labels: LanguageLabels }) {
  const pathname = usePathname() ?? "/";
  const route = currentRouteForPath(pathname);
  const target = route
    ? languageSwitchTarget(route.id, locale)
    : locale === "en"
      ? { href: "/zh", label: labels.chineseHome, equivalent: false }
      : { href: "/", label: labels.switchToEnglish, equivalent: false };
  const label = target.equivalent
    ? locale === "en" ? labels.switchToChinese : labels.switchToEnglish
    : target.label;

  return (
    <Link
      href={target.href}
      className="relative inline-flex min-h-10 items-center rounded-full border border-white/[0.12] px-3 text-[12px] text-[var(--ink-2)] transition-colors hover:border-[var(--gold)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
      data-language-switch
      data-equivalent={target.equivalent ? "true" : "false"}
    >
      {label}
    </Link>
  );
}
