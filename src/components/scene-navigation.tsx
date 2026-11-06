"use client";

import React, { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { currentRouteForPath, languageSwitchTarget } from "@/i18n/helpers";
import type { ContentLocale } from "@/i18n/config";

const UserNavControl = dynamic(
  () => import("@/components/auth/user-nav-control").then(m => m.UserNavControl),
  { ssr: false }
);

const SceneNavigationPanels = dynamic(
  () => import("@/components/scene-navigation-panels").then(m => m.SceneNavigationPanels),
  { ssr: false }
);

type Panel = "methods" | "info";

export function SceneNavigation({ locale = "en", authEnabled = false }: { locale?: ContentLocale; authEnabled?: boolean }) {
  const zh = locale === "zh-Hans";
  const pathname = usePathname() ?? (zh ? "/zh" : "/");
  const [panel, setPanel] = useState<Panel | null>(null);
  const id = useId();
  const rootRef = useRef<HTMLElement>(null);
  const methodsTrigger = useRef<HTMLButtonElement>(null);
  const infoTrigger = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusRequest = useRef<"first" | "last" | null>(null);
  const localize = (path: string) => zh ? `/zh${path === "/" ? "" : path}` : path;
  const route = currentRouteForPath(pathname);
  const languageHref = route ? languageSwitchTarget(route.id, locale).href : zh ? "/" : "/zh";
  const triggerFor = (name: Panel) => name === "methods" ? methodsTrigger.current : infoTrigger.current;

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

  function triggerKey(event: KeyboardEvent<HTMLButtonElement>, name: Panel) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const first = event.key === "ArrowDown";
    if (panel === name) {
      const items = panelRef.current?.querySelectorAll<HTMLElement>("section:not([hidden]) a[href],section:not([hidden]) button");
      (first ? items?.[0] : items?.[items.length - 1])?.focus();
    } else {
      focusRequest.current = first ? "first" : "last";
      setPanel(name);
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
    <header ref={rootRef} className="scene-navigation" data-scene-panel={panel ?? "closed"} aria-label={zh ? "主导航" : "Main navigation"}>
      <div className="scene-utility" onClick={() => setPanel(null)}>
        <div className="scene-languages" data-language-switcher aria-label={zh ? "选择语言" : "Select language"}>
          <Globe aria-hidden="true" />
          <Link href={zh ? languageHref : "/"} prefetch={false} hrefLang="en" lang="en" aria-current={!zh ? "page" : undefined} onClick={() => setPanel(null)}>EN</Link>
          <span aria-hidden="true">/</span>
          <Link href={zh ? "/zh" : languageHref} prefetch={false} hrefLang="zh-Hans" lang="zh-Hans" aria-current={zh ? "page" : undefined} onClick={() => setPanel(null)}>中文</Link>
        </div>
        {authEnabled ? <>
          <span className="scene-utility-divider" aria-hidden="true" />
          <UserNavControl locale={locale} appearance="scene" onItemClick={() => setPanel(null)} />
        </> : null}
      </div>

      <Link href={localize("/")} prefetch={false} className="scene-brand" onClick={() => setPanel(null)}>
        <Image unoptimized src="/navigation/logo.webp" alt="" width={72} height={72} priority />
        <span>Quick I Ching</span>
      </Link>

      <nav className="scene-scrolls" aria-label={zh ? "探索易经" : "Explore the I Ching"}>
        <Link href={localize("/hexagrams")} className="scene-scroll scene-scroll-hexagrams" prefetch={false}>
          <Image unoptimized src="/navigation/scroll-64-hexagrams-no-text.webp" alt="" width={450} height={675} priority fetchPriority="high" decoding="sync" />
          <span>{zh ? "六十四卦" : <>64<br />Hexagrams</>}</span>
        </Link>
        <button ref={methodsTrigger} type="button" className="scene-scroll scene-scroll-methods" aria-expanded={panel === "methods"} aria-controls={`${id}-methods`} onClick={() => setPanel(panel === "methods" ? null : "methods")} onKeyDown={event => triggerKey(event, "methods")}>
          <Image unoptimized src="/navigation/scroll-other-methods-no-text.webp" alt="" width={338} height={675} fetchPriority="low" />
          <span>{zh ? "其他起卦" : <>Other<br />Methods</>}</span>
        </button>
        <button ref={infoTrigger} type="button" className="scene-scroll scene-scroll-info" aria-expanded={panel === "info"} aria-controls={`${id}-info`} onClick={() => setPanel(panel === "info" ? null : "info")} onKeyDown={event => triggerKey(event, "info")}>
          <Image unoptimized src="/navigation/scroll-info-no-text.webp" alt="" width={338} height={675} fetchPriority="low" />
          <span>{zh ? "资讯" : "Info"}</span>
        </button>
        <Image unoptimized className="scene-scroll-holder" src="/navigation/scroll-holder.webp" alt="" width={220} height={132} fetchPriority="low" />
      </nav>

      <div ref={panelRef} className="scene-panels" onKeyDown={panelKey} onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== methodsTrigger.current && event.relatedTarget !== infoTrigger.current) setPanel(null);
      }}>
        {panel ? <SceneNavigationPanels locale={locale} panel={panel} id={id} onClose={() => setPanel(null)} /> : null}
      </div>
    </header>
  );
}
