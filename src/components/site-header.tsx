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
  requestSearch,
}: {
  locale: ContentLocale;
  authEnabled: boolean;
  contract: SurfaceContract;
  requestSearch?: string;
}) {
  if (contract.presentation === "none") return null;

  if (contract.presentation === "content") {
    return <ContentNavigationShell locale={locale} authEnabled={authEnabled} contract={contract} />;
  }

  if (contract.presentation === "info") {
    return <InfoPageHeader locale={locale} authEnabled={authEnabled} contract={contract} />;
  }

  return <SceneNavigation locale={locale} authEnabled={authEnabled} contract={contract} requestSearch={requestSearch} />;
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
  // Next can expose an empty search snapshot for one hydration render on a
  // direct Pricing request. The browser URL is the authoritative request
  // location in that client-only window; using it only as an empty-snapshot
  // fallback prevents a transient S15 locale href from dropping S16 context.
  const browserSearch = typeof window === "undefined" ? "" : window.location.search;
  const search = searchString ? `?${searchString}` : browserSearch;
  const authoritativeFlowState = hasPricingFlowContext(search)
    ? { ...flowState, pricingReadingContext: true }
    : flowState;
  const contract = resolveSurfaceContract({ pathname, flowState: authoritativeFlowState });
  return <SurfaceHeader locale={locale} authEnabled={authEnabled} contract={contract} requestSearch={search} />;
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

  // Pricing carries transaction identity in the request query. Resolve that
  // query in the shell so locale hrefs are correct before navigation-location's
  // post-hydration synchronization window.
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
