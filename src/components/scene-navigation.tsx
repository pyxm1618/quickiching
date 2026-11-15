"use client";

import React, { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { SeoRouteGraph } from "@/components/seo-route-graph";
import { localeSwitchTarget, shellHomeTarget } from "@/navigation/locale-navigation";
import { useNavigationLocation } from "@/navigation/navigation-location";
import { surfaceContract, type SurfaceContract } from "@/navigation/surface-contract";
import type { ContentLocale } from "@/i18n/config";
import type { PublicReadingMethod } from "@/domain/public-reading/types";
import {
  getLiveFlowRegistration,
  issueLocaleContinuationIntent,
  prepareLocaleContinuationClick,
} from "@/lib/reading-resume";
import { readCheckoutReturnContext } from "@/app/(default)/pricing/checkout-return-context";

const UserNavControl = dynamic(
  () => import("@/components/auth/user-nav-control").then(m => m.UserNavControl),
  { ssr: false }
);

const loadSceneNavigationPanels = () => import("@/components/scene-navigation-panels");

type Panel = "methods" | "info";

function continuationMethodForSurface(id: SurfaceContract["id"]): PublicReadingMethod | null {
  if (id === "S02") return "three-coin";
  if (id === "S06") return "yarrow-stalks";
  if (id === "S07") return "mei-hua-yi-shu";
  if (id === "S08") return "manual";
  return null;
}

export function SceneNavigation({
  locale = "en",
  authEnabled = false,
  contract = surfaceContract("S01"),
  requestSearch,
}: {
  locale?: ContentLocale;
  authEnabled?: boolean;
  contract?: SurfaceContract;
  /** Exact request-query snapshot for transactional surfaces such as Pricing. */
  requestSearch?: string;
}) {
  const zh = locale === "zh-Hans";
  const pathname = usePathname() ?? (zh ? "/zh" : "/");
  const [panel, setPanel] = useState<Panel | null>(null);
  const location = useNavigationLocation();
  const id = useId();
  const rootRef = useRef<HTMLElement>(null);
  const methodsTrigger = useRef<HTMLButtonElement>(null);
  const infoTrigger = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelComponentRef = useRef<(typeof import("@/components/scene-navigation-panels"))["SceneNavigationPanels"] | null>(null);
  const focusRequest = useRef<"first" | "last" | null>(null);
  const localize = (path: string) => zh ? `/zh${path === "/" ? "" : path}` : path;
  const homeHref = shellHomeTarget(locale);
  const currentSearch = requestSearch ?? location.search;
  const currentOrderId = contract.id === "S16"
    ? new URLSearchParams(currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch).get("orderId")
    : null;
  const [freshPaymentRecoveryOrderId, setFreshPaymentRecoveryOrderId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (contract.id !== "S16" || !currentOrderId) {
      setFreshPaymentRecoveryOrderId(null);
      return;
    }
    const context = readCheckoutReturnContext(window.sessionStorage);
    setFreshPaymentRecoveryOrderId(context?.orderId === currentOrderId ? currentOrderId : null);
  }, [contract.id, currentOrderId]);

  const computedLocaleTarget = localeSwitchTarget({
    pathname,
    search: currentSearch,
    hash: location.hash,
    currentLocale: locale,
    paymentRecoveryOrderId: freshPaymentRecoveryOrderId ?? undefined,
  });
  // Pricing reading-return (S16) is query-identified. During the Suspense
  // fallback there is no authoritative request query yet, so exposing a live
  // locale link would create a brief href that can drop returnUrl. Keep the
  // locale indicator non-interactive until PricingHeader supplies requestSearch.
  // URL transformation still belongs exclusively to localeSwitchTarget().
  const paymentRecoveryValidationPending = contract.id === "S16"
    && Boolean(currentOrderId)
    && freshPaymentRecoveryOrderId === undefined;
  const localeTarget = contract.id === "S16" && (requestSearch === undefined || paymentRecoveryValidationPending)
    ? { ...computedLocaleTarget, available: false }
    : computedLocaleTarget;
  const triggerFor = (name: Panel) => name === "methods" ? methodsTrigger.current : infoTrigger.current;

  function handleLocaleClick(event: MouseEvent<HTMLAnchorElement>, targetLocale: ContentLocale) {
    setPanel(null);
    const expectedMethod = continuationMethodForSurface(contract.id);
    const registered = getLiveFlowRegistration();
    const liveFlow = expectedMethod && registered?.method === expectedMethod ? registered : null;
    const decision = prepareLocaleContinuationClick({
      event,
      targetLocale,
      liveFlow,
      issueIntent: issueLocaleContinuationIntent,
    });
    // C9 write failure is fail-closed.
    if (decision === "cancel") {
      event.preventDefault();
      return;
    }

    // Pricing carries its flow identity in the query. A Next/Suspense shell can
    // briefly render before that query snapshot reaches the header even though
    // window.location already contains the exact request URL. On an ordinary
    // primary click only, re-run the *existing* C5 owner against that exact
    // browser location. This is a stale-render fail-safe, not a second URL
    // transformation authority; modified/middle clicks remain native browser
    // behavior because prepareLocaleContinuationClick returned "ignore".
    if (
      decision === "navigate"
      && typeof window !== "undefined"
      && (window.location.pathname === "/pricing" || window.location.pathname === "/zh/pricing")
    ) {
      const browserSearch = window.location.search;
      const browserOrderId = new URLSearchParams(browserSearch.startsWith("?") ? browserSearch.slice(1) : browserSearch).get("orderId");
      const recoveryContext = browserOrderId ? readCheckoutReturnContext(window.sessionStorage) : null;
      const exactPricingTarget = localeSwitchTarget({
        pathname: window.location.pathname,
        search: browserSearch,
        hash: window.location.hash,
        currentLocale: locale,
        paymentRecoveryOrderId: recoveryContext?.orderId === browserOrderId ? browserOrderId : undefined,
      });
      if (exactPricingTarget.available && exactPricingTarget.href !== localeTarget.href) {
        event.preventDefault();
        window.location.assign(exactPricingTarget.href);
      }
    }
  }

  useEffect(() => {
    setPanel(null);
  }, [locale]);

  useEffect(() => {
    if (!panel) return;
    function outside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setPanel(null);
    }
    function escape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPanel(null);
        triggerFor(panel!)?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [panel]);

  useEffect(() => {
    if (!panel || !focusRequest.current) return;
    const request = focusRequest.current;
    let frame = 0;
    let disposed = false;
    const focusWhenReady = () => {
      if (disposed) return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>("section:not([hidden]) a[href],section:not([hidden]) button");
      if (items?.length) {
        focusRequest.current = null;
        (request === "first" ? items[0] : items[items.length - 1])?.focus();
        return;
      }
      frame = requestAnimationFrame(focusWhenReady);
    };
    frame = requestAnimationFrame(focusWhenReady);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
    };
  }, [panel]);

  async function openPanel(name: Panel) {
    const panelsModule = await loadSceneNavigationPanels();
    panelComponentRef.current = panelsModule.SceneNavigationPanels;
    setPanel(name);
  }

  async function togglePanel(name: Panel) {
    if (panel === name) {
      setPanel(null);
      return;
    }
    await openPanel(name);
  }

  function triggerKey(event: KeyboardEvent<HTMLButtonElement>, name: Panel) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const first = event.key === "ArrowDown";
    if (panel === name) {
      const items = panelRef.current?.querySelectorAll<HTMLElement>("section:not([hidden]) a[href],section:not([hidden]) button");
      (first ? items?.[0] : items?.[items.length - 1])?.focus();
    } else {
      focusRequest.current = first ? "first" : "last";
      void openPanel(name);
    }
  }

  function panelKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>("section:not([hidden]) a[href],section:not([hidden]) button") ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <header
      ref={rootRef}
      className="scene-navigation"
      data-scene-panel={panel ?? "closed"}
      data-navigation-surface={contract.id}
      data-navigation-mode={contract.mode}
      data-shell-layout={contract.layout}
      aria-label={zh ? "主导航" : "Main navigation"}
    >
      <div className="scene-utility" onClick={() => setPanel(null)}>
        <div className="scene-languages" data-language-switcher aria-label={zh ? "选择语言" : "Select language"}>
          <Globe aria-hidden="true" />
          {zh ? (
            localeTarget.available
              ? <Link href={localeTarget.href} prefetch={false} hrefLang="en" lang="en" data-locale-switch="en" onClick={(event) => handleLocaleClick(event, "en")}>EN</Link>
              : <span lang="en">EN</span>
          ) : <span lang="en" aria-current="page">EN</span>}
          <span aria-hidden="true">/</span>
          {zh ? <span lang="zh-Hans" aria-current="page">中文</span> : (
            localeTarget.available
              ? <Link href={localeTarget.href} prefetch={false} hrefLang="zh-Hans" lang="zh-Hans" data-locale-switch="zh-Hans" onClick={(event) => handleLocaleClick(event, "zh-Hans")}>中文</Link>
              : <span lang="zh-Hans">中文</span>
          )}
        </div>
        {authEnabled ? <>
          <span className="scene-utility-divider" aria-hidden="true" />
          <UserNavControl locale={locale} appearance="scene" onItemClick={() => setPanel(null)} />
        </> : null}
      </div>

      <Link href={homeHref} prefetch={false} className="scene-brand" data-shell-home onClick={() => setPanel(null)}>
        <Image unoptimized src="/navigation/logo.webp" alt="" width={72} height={72} priority />
        <span>Quick I Ching</span>
      </Link>

      <SeoRouteGraph locale={locale} />

      {contract.primaryNavigation ? <nav className="scene-scrolls" aria-label={zh ? "探索易经" : "Explore the I Ching"}>
        <Link href={localize("/hexagrams")} className="scene-scroll scene-scroll-hexagrams" prefetch={false}>
          <Image src="/navigation/scroll-64-hexagrams-no-text.webp" alt="" width={450} height={675} sizes="(max-width: 800px) 94px, 151px" quality={90} priority fetchPriority="high" decoding="sync" />
          <span>{zh ? "六十四卦" : <>64<br />Hexagrams</>}</span>
        </Link>
        <button ref={methodsTrigger} type="button" className="scene-scroll scene-scroll-methods" aria-expanded={panel === "methods"} aria-controls={`${id}-methods`} onClick={() => void togglePanel("methods")} onKeyDown={event => triggerKey(event, "methods")}>
          <Image src="/navigation/scroll-other-methods-no-text.webp" alt="" width={338} height={675} sizes="(max-width: 800px) 76px, 122px" quality={90} fetchPriority="low" />
          <span>{zh ? "其他起卦" : <>Other<br />Methods</>}</span>
        </button>
        <button ref={infoTrigger} type="button" className="scene-scroll scene-scroll-info" aria-expanded={panel === "info"} aria-controls={`${id}-info`} onClick={() => void togglePanel("info")} onKeyDown={event => triggerKey(event, "info")}>
          <Image src="/navigation/scroll-info-no-text.webp" alt="" width={338} height={675} sizes="(max-width: 800px) 69px, 111px" quality={90} fetchPriority="low" />
          <span>{zh ? "资讯" : "Info"}</span>
        </button>
        <Image className="scene-scroll-holder" src="/navigation/scroll-holder.webp" alt="" width={220} height={132} sizes="(max-width: 800px) 136px, 220px" quality={90} fetchPriority="low" />
      </nav> : null}

      <div ref={panelRef} className="scene-panels" onKeyDown={panelKey} onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== methodsTrigger.current && event.relatedTarget !== infoTrigger.current) setPanel(null);
      }}>
        {panel && panelComponentRef.current ? React.createElement(panelComponentRef.current, { locale, panel, id, onClose: () => setPanel(null) }) : null}
      </div>
    </header>
  );
}
