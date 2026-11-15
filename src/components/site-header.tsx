"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { SceneNavigation } from "@/components/scene-navigation";
import { ContentNavigationShell } from "@/components/navigation/content-navigation-shell";
import { useNavigationFlowState } from "@/navigation/navigation-surface-context";
import { resolveSurfaceContract } from "@/navigation/surface-contract";
import type { ContentLocale } from "@/i18n/config";

const InfoPageHeader = dynamic(() => import("@/components/info-pages/info-page-header").then(m => m.InfoPageHeader), { ssr: true });

/**
 * The single global navigation shell.
 *
 * The shell resolves one Surface Contract from route + flow state and then
 * renders only the capabilities that contract authorizes. Surfaces never pick
 * a header, and never hide or duplicate shell-owned navigation.
 */
export function SiteHeader({
  locale = "en",
  authEnabled = false,
}: {
  locale?: ContentLocale;
  authEnabled?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const flowState = useNavigationFlowState();
  const contract = resolveSurfaceContract({ pathname, flowState });

  if (contract.presentation === "none") return null;

  // S04 owns a full-bleed composition: the Content presentation reserves its
  // own band instead of floating over the detail scroll.
  if (contract.presentation === "content") {
    return <ContentNavigationShell locale={locale} authEnabled={authEnabled} contract={contract} />;
  }

  if (contract.presentation === "info") {
    return <InfoPageHeader locale={locale} authEnabled={authEnabled} contract={contract} />;
  }

  return <SceneNavigation locale={locale} authEnabled={authEnabled} contract={contract} />;
}
