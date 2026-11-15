"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { SceneNavigation } from "@/components/scene-navigation";
import { ContentNavigationShell } from "@/components/navigation/content-navigation-shell";
import { useNavigationFlowState } from "@/navigation/navigation-surface-context";
import {
  hasPricingFlowContext,
  resolveSurfaceContract,
  surfaceContract,
  type NavigationFlowState,
  type SurfaceContract,
} from "@/navigation/surface-contract";
import type { ContentLocale } from "@/i18n/config";

const InfoPageHeader = dynamic(() => import("@/components/info-pages/info-page-header").then(m => m.InfoPageHeader), { ssr: true });

function SurfaceHeader({
  locale,
  authEnabled,
  contract,
}: {
  locale: ContentLocale;
  authEnabled: boolean;
  contract: SurfaceContract;
}) {
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

function PricingHeader({
  locale,
  authEnabled,
  pathname,
  flowState,
}: {
  locale: ContentLocale;
  authEnabled: boolean;
  pathname: string;
  flowState: NavigationFlowState;
}) {
  const searchParams = useSearchParams();
  const searchString = searchParams.toString();
  const search = searchString ? `?${searchString}` : "";
  const authoritativeFlowState = hasPricingFlowContext(search)
    ? { ...flowState, pricingReadingContext: true }
    : flowState;
  const contract = resolveSurfaceContract({ pathname, flowState: authoritativeFlowState });
  return <SurfaceHeader locale={locale} authEnabled={authEnabled} contract={contract} />;
}

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

  // Pricing is dynamic and its transaction identity is in the request query.
  // Resolve that query inside the shell so an orderId/returnUrl request is S16
  // on the first authoritative render instead of waiting for a page useEffect.
  if (pathname === "/pricing" || pathname === "/zh/pricing") {
    return (
      <Suspense
        fallback={
          <SurfaceHeader
            locale={locale}
            authEnabled={authEnabled}
            contract={surfaceContract("S16")}
          />
        }
      >
        <PricingHeader
          locale={locale}
          authEnabled={authEnabled}
          pathname={pathname}
          flowState={flowState}
        />
      </Suspense>
    );
  }

  const contract = resolveSurfaceContract({ pathname, flowState });
  return <SurfaceHeader locale={locale} authEnabled={authEnabled} contract={contract} />;
}
