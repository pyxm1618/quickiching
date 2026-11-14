"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { SceneNavigation } from "@/components/scene-navigation";
import type { ContentLocale } from "@/i18n/config";

const InfoPageHeader = dynamic(() => import("@/components/info-pages/info-page-header").then(m => m.InfoPageHeader), { ssr: true });

const INFO_PAGE_PATHS = new Set([
  "/guides/how-to-ask-the-i-ching",
  "/guides/changing-lines",
  "/guides/primary-relating-hexagrams",
  "/help",
  "/privacy",
  "/terms",
  "/acceptable-use",
]);

export function SiteHeader({
  locale = "en",
  authEnabled = false,
}: {
  locale?: ContentLocale;
  authEnabled?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const infoPath = pathname.startsWith("/zh/") ? pathname.slice(3) : pathname;

  if (INFO_PAGE_PATHS.has(infoPath)) {
    return <InfoPageHeader locale={locale} authEnabled={authEnabled} />;
  }

  return <SceneNavigation locale={locale} authEnabled={authEnabled} />;
}
