"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getDictionary } from "@/i18n/dictionaries";
import type { ContentLocale } from "@/i18n/config";

const NAV_LINK_CLASS =
  "relative min-h-11 inline-flex items-center text-[13px] font-medium text-[var(--ink-2)] transition-colors hover:text-[var(--ink)] after:absolute after:bottom-1 after:left-0 after:h-px after:w-0 after:bg-[var(--cinnabar)] after:transition-all hover:after:w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cinnabar)]";

const DROPDOWN_BTN_CLASS =
  "relative min-h-11 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--ink-2)] transition-colors hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cinnabar)] cursor-pointer";

const MENU_ITEM_CLASS =
  "flex min-h-11 w-full items-center rounded-lg px-3.5 py-2.5 text-xs font-medium text-[var(--ink-2)] transition-colors hover:bg-white/[0.08] hover:text-[var(--ink)] focus:bg-white/[0.1] focus:text-[var(--ink)] focus:outline-none";

const DRAWER_LINK_CLASS =
  "flex min-h-11 items-center rounded-xl px-4 py-3 text-sm font-medium text-[var(--ink-2)] transition-colors hover:bg-white/[0.08] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cinnabar)]";

export function SiteHeader({ locale = "en" }: { locale?: ContentLocale }) {
  const dictionary = getDictionary(locale);
  const isChinese = locale === "zh-Hans";
  const pathname = usePathname() ?? "/";

  // Dropdown states
  const [isMethodsOpen, setIsMethodsOpen] = useState(false);
  const [isGuidesOpen, setIsGuidesOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  // Dynamic IDs via React useId
  const rawId = useId().replace(/[^a-zA-Z0-9-_]/g, "");
  const methodsTriggerId = `methods-trig-${rawId}`;
  const methodsMenuId = `methods-menu-${rawId}`;
  const guidesTriggerId = `guides-trig-${rawId}`;
  const guidesMenuId = `guides-menu-${rawId}`;
  const drawerTriggerId = `drawer-trig-${rawId}`;
  const drawerId = `nav-drawer-${rawId}`;

  // Refs for keyboard and focus management
  const methodsContainerRef = useRef<HTMLDivElement>(null);
  const methodsTriggerRef = useRef<HTMLButtonElement>(null);
  const methodsItemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const methodsFocusRequestRef = useRef<"first" | "last" | null>(null);

  const guidesContainerRef = useRef<HTMLDivElement>(null);
  const guidesTriggerRef = useRef<HTMLButtonElement>(null);
  const guidesItemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const guidesFocusRequestRef = useRef<"first" | "last" | null>(null);

  const brandRef = useRef<HTMLAnchorElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerCloseBtnRef = useRef<HTMLButtonElement>(null);

  const isCurrentPath = (href: string) => pathname === href;
  const linkClassName = (base: string, href: string) =>
    `${base} ${isCurrentPath(href) ? "bg-white/[0.05] text-[var(--ink)]" : ""}`;

  const closeDrawer = (returnFocus = true) => {
    setIsDrawerOpen(false);
    if (returnFocus) {
      requestAnimationFrame(() => drawerTriggerRef.current?.focus());
    }
  };

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  // Close drawer on pathname change
  useEffect(() => {
    setIsDrawerOpen(false);
    setIsMethodsOpen(false);
    setIsGuidesOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMethodsOpen || !methodsFocusRequestRef.current) return;
    const request = methodsFocusRequestRef.current;
    methodsFocusRequestRef.current = null;
    const frame = requestAnimationFrame(() => {
      const items = methodsItemRefs.current.filter(Boolean);
      (request === "first" ? items[0] : items.at(-1))?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isMethodsOpen]);

  useEffect(() => {
    if (!isGuidesOpen || !guidesFocusRequestRef.current) return;
    const request = guidesFocusRequestRef.current;
    guidesFocusRequestRef.current = null;
    const frame = requestAnimationFrame(() => {
      const items = guidesItemRefs.current.filter(Boolean);
      (request === "first" ? items[0] : items.at(-1))?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isGuidesOpen]);

  // Click outside listener for desktop dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (methodsContainerRef.current && !methodsContainerRef.current.contains(event.target as Node)) {
        setIsMethodsOpen(false);
      }
      if (guidesContainerRef.current && !guidesContainerRef.current.contains(event.target as Node)) {
        setIsGuidesOpen(false);
      }
    }
    if (isMethodsOpen || isGuidesOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isGuidesOpen, isMethodsOpen]);

  // Drawer body scroll lock & focus trap
  useEffect(() => {
    if (isDrawerOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      drawerCloseBtnRef.current?.focus();

      function handleDrawerKeyDown(e: globalThis.KeyboardEvent) {
        if (e.defaultPrevented) return;
        if (e.key === "Escape") {
          e.preventDefault();
          setIsDrawerOpen(false);
          drawerTriggerRef.current?.focus();
        } else if (e.key === "Tab" && drawerRef.current) {
          const focusables = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
            'a[href]:not([tabindex="-1"]), button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )).filter((node) => {
            const style = window.getComputedStyle(node);
            return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
          });
          if (focusables.length === 0) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }

      document.addEventListener("keydown", handleDrawerKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        document.removeEventListener("keydown", handleDrawerKeyDown);
      };
    }
  }, [isDrawerOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const handleBreakpointChange = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) {
        const activeWasInDrawer = Boolean(drawerRef.current?.contains(document.activeElement));
        setIsDrawerOpen(false);
        if (activeWasInDrawer) requestAnimationFrame(() => brandRef.current?.focus());
      } else {
        setIsMethodsOpen(false);
        setIsGuidesOpen(false);
      }
    };
    desktop.addEventListener("change", handleBreakpointChange);
    return () => desktop.removeEventListener("change", handleBreakpointChange);
  }, []);

  // Keyboard handlers for Methods dropdown
  const handleMethodsTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setIsMethodsOpen(false);
    } else if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      if (isMethodsOpen) {
        methodsItemRefs.current[0]?.focus();
      } else {
        methodsFocusRequestRef.current = "first";
        setIsMethodsOpen(true);
      }
      setIsGuidesOpen(false);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isMethodsOpen) {
        methodsItemRefs.current.filter(Boolean).at(-1)?.focus();
      } else {
        methodsFocusRequestRef.current = "last";
        setIsMethodsOpen(true);
      }
      setIsGuidesOpen(false);
    }
  };

  const handleMethodsItemKeyDown = (e: KeyboardEvent, index: number) => {
    const items = methodsItemRefs.current.filter(Boolean);
    if (e.key === "Escape") {
      e.preventDefault();
      setIsMethodsOpen(false);
      methodsTriggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (index + 1) % items.length;
      items[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (index - 1 + items.length) % items.length;
      items[prev]?.focus();
    } else if (e.key === "Tab") {
      setIsMethodsOpen(false);
    }
  };

  // Keyboard handlers for Guides dropdown
  const handleGuidesTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setIsGuidesOpen(false);
    } else if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      if (isGuidesOpen) {
        guidesItemRefs.current[0]?.focus();
      } else {
        guidesFocusRequestRef.current = "first";
        setIsGuidesOpen(true);
      }
      setIsMethodsOpen(false);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isGuidesOpen) {
        guidesItemRefs.current.filter(Boolean).at(-1)?.focus();
      } else {
        guidesFocusRequestRef.current = "last";
        setIsGuidesOpen(true);
      }
      setIsMethodsOpen(false);
    }
  };

  const handleGuidesItemKeyDown = (e: KeyboardEvent, index: number) => {
    const items = guidesItemRefs.current.filter(Boolean);
    if (e.key === "Escape") {
      e.preventDefault();
      setIsGuidesOpen(false);
      guidesTriggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (index + 1) % items.length;
      items[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (index - 1 + items.length) % items.length;
      items[prev]?.focus();
    } else if (e.key === "Tab") {
      setIsGuidesOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.07] bg-[#09070f]/80 backdrop-blur-[18px]">
      <div className="mx-auto flex min-h-[74px] max-w-[1240px] items-center justify-between gap-x-6 px-5 py-2 sm:px-7">
        {/* Brand Logo - exactly 1 visible product name */}
        <Link
          ref={brandRef}
          href={isChinese ? "/zh" : "/"}
          className="flex min-h-11 items-center gap-3 font-semibold tracking-[0.02em] text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--cinnabar)]"
        >
          <BrandMark size="md" priority />
          <span>Quick I Ching</span>
        </Link>

        {/* Desktop Navigation (>= 1024px) */}
        <nav
          className="hidden lg:flex items-center gap-x-6"
          aria-label={dictionary.nav.ariaLabel}
        >
          {isChinese ? (
            <>
              <Link href="/zh/methods/mei-hua-yi-shu" aria-current={isCurrentPath("/zh/methods/mei-hua-yi-shu") ? "page" : undefined} className={linkClassName(NAV_LINK_CLASS, "/zh/methods/mei-hua-yi-shu")}>
                {dictionary.nav.meiHua}
              </Link>
              <Link href="/zh/hexagrams" aria-current={isCurrentPath("/zh/hexagrams") ? "page" : undefined} className={linkClassName(NAV_LINK_CLASS, "/zh/hexagrams")}>
                {dictionary.nav.hexagrams}
              </Link>
            </>
          ) : (
            <>
              {/* Methods Dropdown */}
              <div ref={methodsContainerRef} className="relative inline-block text-left">
                <button
                  ref={methodsTriggerRef}
                  id={methodsTriggerId}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isMethodsOpen}
                  aria-controls={methodsMenuId}
                  onClick={() => {
                    setIsMethodsOpen((prev) => !prev);
                    setIsGuidesOpen(false);
                  }}
                  onKeyDown={handleMethodsTriggerKeyDown}
                  className={`${DROPDOWN_BTN_CLASS} ${pathname.startsWith("/methods/") ? "text-[var(--ink)]" : ""}`}
                >
                  <span>{dictionary.nav.methods}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${isMethodsOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                <div
                  id={methodsMenuId}
                  role="menu"
                  aria-labelledby={methodsTriggerId}
                  className={`absolute left-0 mt-1.5 z-50 min-w-[200px] origin-top-left rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-1.5 shadow-xl backdrop-blur-md focus:outline-none ${isMethodsOpen ? "block" : "hidden"}`}
                >
                  <Link
                    ref={(el) => { methodsItemRefs.current[0] = el; }}
                    href="/methods/three-coin"
                    aria-current={isCurrentPath("/methods/three-coin") ? "page" : undefined}
                    role="menuitem"
                    tabIndex={isMethodsOpen ? 0 : -1}
                    onClick={() => setIsMethodsOpen(false)}
                    onKeyDown={(e) => handleMethodsItemKeyDown(e, 0)}
                    className={linkClassName(MENU_ITEM_CLASS, "/methods/three-coin")}
                  >
                    {dictionary.nav.threeCoin}
                  </Link>
                  <Link
                    ref={(el) => { methodsItemRefs.current[1] = el; }}
                    href="/methods/yarrow-stalks"
                    aria-current={isCurrentPath("/methods/yarrow-stalks") ? "page" : undefined}
                    role="menuitem"
                    tabIndex={isMethodsOpen ? 0 : -1}
                    onClick={() => setIsMethodsOpen(false)}
                    onKeyDown={(e) => handleMethodsItemKeyDown(e, 1)}
                    className={linkClassName(MENU_ITEM_CLASS, "/methods/yarrow-stalks")}
                  >
                    {dictionary.nav.yarrow}
                  </Link>
                  <Link
                    ref={(el) => { methodsItemRefs.current[2] = el; }}
                    href="/methods/mei-hua-yi-shu"
                    aria-current={isCurrentPath("/methods/mei-hua-yi-shu") ? "page" : undefined}
                    role="menuitem"
                    tabIndex={isMethodsOpen ? 0 : -1}
                    onClick={() => setIsMethodsOpen(false)}
                    onKeyDown={(e) => handleMethodsItemKeyDown(e, 2)}
                    className={linkClassName(MENU_ITEM_CLASS, "/methods/mei-hua-yi-shu")}
                  >
                    {dictionary.nav.meiHua}
                  </Link>
                  <Link
                    ref={(el) => { methodsItemRefs.current[3] = el; }}
                    href="/methods/manual-cast"
                    aria-current={isCurrentPath("/methods/manual-cast") ? "page" : undefined}
                    role="menuitem"
                    tabIndex={isMethodsOpen ? 0 : -1}
                    onClick={() => setIsMethodsOpen(false)}
                    onKeyDown={(e) => handleMethodsItemKeyDown(e, 3)}
                    className={linkClassName(MENU_ITEM_CLASS, "/methods/manual-cast")}
                  >
                    {dictionary.nav.manual}
                  </Link>
                </div>
              </div>

              {/* Guides Dropdown */}
              <div ref={guidesContainerRef} className="relative inline-block text-left">
                <button
                  ref={guidesTriggerRef}
                  id={guidesTriggerId}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isGuidesOpen}
                  aria-controls={guidesMenuId}
                  onClick={() => {
                    setIsGuidesOpen((prev) => !prev);
                    setIsMethodsOpen(false);
                  }}
                  onKeyDown={handleGuidesTriggerKeyDown}
                  className={`${DROPDOWN_BTN_CLASS} ${pathname.startsWith("/guides/") ? "text-[var(--ink)]" : ""}`}
                >
                  <span>{dictionary.nav.guides}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${isGuidesOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                <div
                  id={guidesMenuId}
                  role="menu"
                  aria-labelledby={guidesTriggerId}
                  className={`absolute left-0 mt-1.5 z-50 min-w-[240px] origin-top-left rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-1.5 shadow-xl backdrop-blur-md focus:outline-none ${isGuidesOpen ? "block" : "hidden"}`}
                >
                  <Link
                    ref={(el) => { guidesItemRefs.current[0] = el; }}
                    href="/guides/how-to-ask-the-i-ching"
                    aria-current={isCurrentPath("/guides/how-to-ask-the-i-ching") ? "page" : undefined}
                    role="menuitem"
                    tabIndex={isGuidesOpen ? 0 : -1}
                    onClick={() => setIsGuidesOpen(false)}
                    onKeyDown={(e) => handleGuidesItemKeyDown(e, 0)}
                    className={linkClassName(MENU_ITEM_CLASS, "/guides/how-to-ask-the-i-ching")}
                  >
                    {dictionary.nav.howToAsk}
                  </Link>
                  <Link
                    ref={(el) => { guidesItemRefs.current[1] = el; }}
                    href="/guides/changing-lines"
                    aria-current={isCurrentPath("/guides/changing-lines") ? "page" : undefined}
                    role="menuitem"
                    tabIndex={isGuidesOpen ? 0 : -1}
                    onClick={() => setIsGuidesOpen(false)}
                    onKeyDown={(e) => handleGuidesItemKeyDown(e, 1)}
                    className={linkClassName(MENU_ITEM_CLASS, "/guides/changing-lines")}
                  >
                    {dictionary.nav.changingLines}
                  </Link>
                  <Link
                    ref={(el) => { guidesItemRefs.current[2] = el; }}
                    href="/guides/primary-relating-hexagrams"
                    aria-current={isCurrentPath("/guides/primary-relating-hexagrams") ? "page" : undefined}
                    role="menuitem"
                    tabIndex={isGuidesOpen ? 0 : -1}
                    onClick={() => setIsGuidesOpen(false)}
                    onKeyDown={(e) => handleGuidesItemKeyDown(e, 2)}
                    className={linkClassName(MENU_ITEM_CLASS, "/guides/primary-relating-hexagrams")}
                  >
                    {dictionary.nav.primaryRelating}
                  </Link>
                </div>
              </div>

              <Link href="/hexagrams" aria-current={isCurrentPath("/hexagrams") ? "page" : undefined} className={linkClassName(NAV_LINK_CLASS, "/hexagrams")}>
                {dictionary.nav.hexagrams}
              </Link>
              <Link href="/history" aria-current={isCurrentPath("/history") ? "page" : undefined} className={linkClassName(NAV_LINK_CLASS, "/history")}>
                {dictionary.nav.history}
              </Link>
            </>
          )}

          {/* Desktop Language Switcher */}
          <LanguageSwitcher
            locale={locale}
            labels={dictionary.language}
            idPrefix="desktop"
          />
        </nav>

        {/* Mobile & Tablet Controls (< 1024px, including 768px, 390px, 375px, 320px) */}
        <div className="flex lg:hidden items-center gap-2">
          <button
            ref={drawerTriggerRef}
            id={drawerTriggerId}
            type="button"
            aria-expanded={isDrawerOpen}
            aria-controls={drawerId}
            aria-label={dictionary.nav.toggleMenu}
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.04] p-2 text-[var(--ink-2)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cinnabar)] cursor-pointer"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Portal keeps the modal outside Header's backdrop-filter containing block. */}
      {portalRoot && createPortal(
        <div
          id={drawerId}
          className={`fixed inset-0 z-[100] lg:hidden ${isDrawerOpen ? "block" : "hidden"}`}
        >
          {isDrawerOpen && (
            <>
            {/* Backdrop Overlay */}
            <div
              data-drawer-backdrop
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => closeDrawer()}
              aria-hidden="true"
            />

            {/* Slide-over Sheet */}
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label={dictionary.nav.ariaLabel}
              className="absolute inset-y-0 right-0 z-10 flex h-dvh w-[calc(100vw-2rem)] max-w-xs flex-col border-l border-[var(--line)] bg-[var(--paper)] p-6 shadow-2xl"
            >
          {/* Header: Logo & Close Button */}
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
            <span className="font-display font-medium text-lg text-[var(--ink)]">{dictionary.nav.drawerTitle}</span>
            <button
              ref={drawerCloseBtnRef}
              type="button"
              aria-label={dictionary.nav.closeMenu}
              onClick={() => closeDrawer()}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--line)] p-2 text-[var(--ink-2)] hover:bg-white/[0.08] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cinnabar)] cursor-pointer"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Scrollable Navigation Links */}
          <nav className="mt-6 flex-1 space-y-6 overflow-y-auto" aria-label={dictionary.nav.ariaLabel}>
            {isChinese ? (
              <div className="space-y-1">
                <p className="px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">
                  中文导航
                </p>
                <Link
                  href="/zh"
                  aria-current={isCurrentPath("/zh") ? "page" : undefined}
                  onClick={() => closeDrawer()}
                  className={linkClassName(DRAWER_LINK_CLASS, "/zh")}
                >
                  {dictionary.nav.home}
                </Link>
                <Link
                  href="/zh/methods/mei-hua-yi-shu"
                  aria-current={isCurrentPath("/zh/methods/mei-hua-yi-shu") ? "page" : undefined}
                  onClick={() => closeDrawer()}
                  className={linkClassName(DRAWER_LINK_CLASS, "/zh/methods/mei-hua-yi-shu")}
                >
                  {dictionary.nav.meiHua}
                </Link>
                <Link
                  href="/zh/hexagrams"
                  aria-current={isCurrentPath("/zh/hexagrams") ? "page" : undefined}
                  onClick={() => closeDrawer()}
                  className={linkClassName(DRAWER_LINK_CLASS, "/zh/hexagrams")}
                >
                  {dictionary.nav.hexagrams}
                </Link>
              </div>
            ) : (
              <>
                {/* Methods Group */}
                <div className="space-y-1">
                  <p className="px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">
                    {dictionary.nav.methods}
                  </p>
                  <Link
                    href="/methods/three-coin"
                    aria-current={isCurrentPath("/methods/three-coin") ? "page" : undefined}
                    onClick={() => closeDrawer()}
                    className={linkClassName(DRAWER_LINK_CLASS, "/methods/three-coin")}
                  >
                    {dictionary.nav.threeCoin}
                  </Link>
                  <Link
                    href="/methods/yarrow-stalks"
                    aria-current={isCurrentPath("/methods/yarrow-stalks") ? "page" : undefined}
                    onClick={() => closeDrawer()}
                    className={linkClassName(DRAWER_LINK_CLASS, "/methods/yarrow-stalks")}
                  >
                    {dictionary.nav.yarrow}
                  </Link>
                  <Link
                    href="/methods/mei-hua-yi-shu"
                    aria-current={isCurrentPath("/methods/mei-hua-yi-shu") ? "page" : undefined}
                    onClick={() => closeDrawer()}
                    className={linkClassName(DRAWER_LINK_CLASS, "/methods/mei-hua-yi-shu")}
                  >
                    {dictionary.nav.meiHua}
                  </Link>
                  <Link
                    href="/methods/manual-cast"
                    aria-current={isCurrentPath("/methods/manual-cast") ? "page" : undefined}
                    onClick={() => closeDrawer()}
                    className={linkClassName(DRAWER_LINK_CLASS, "/methods/manual-cast")}
                  >
                    {dictionary.nav.manual}
                  </Link>
                </div>

                {/* Guides Group */}
                <div className="space-y-1">
                  <p className="px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">
                    {dictionary.nav.guides}
                  </p>
                  <Link
                    href="/guides/how-to-ask-the-i-ching"
                    aria-current={isCurrentPath("/guides/how-to-ask-the-i-ching") ? "page" : undefined}
                    onClick={() => closeDrawer()}
                    className={linkClassName(DRAWER_LINK_CLASS, "/guides/how-to-ask-the-i-ching")}
                  >
                    {dictionary.nav.howToAsk}
                  </Link>
                  <Link
                    href="/guides/changing-lines"
                    aria-current={isCurrentPath("/guides/changing-lines") ? "page" : undefined}
                    onClick={() => closeDrawer()}
                    className={linkClassName(DRAWER_LINK_CLASS, "/guides/changing-lines")}
                  >
                    {dictionary.nav.changingLines}
                  </Link>
                  <Link
                    href="/guides/primary-relating-hexagrams"
                    aria-current={isCurrentPath("/guides/primary-relating-hexagrams") ? "page" : undefined}
                    onClick={() => closeDrawer()}
                    className={linkClassName(DRAWER_LINK_CLASS, "/guides/primary-relating-hexagrams")}
                  >
                    {dictionary.nav.primaryRelating}
                  </Link>
                </div>

                {/* Reference & History Group */}
                <div className="space-y-1">
                  <p className="px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">
                    Reference
                  </p>
                  <Link
                    href="/hexagrams"
                    aria-current={isCurrentPath("/hexagrams") ? "page" : undefined}
                    onClick={() => closeDrawer()}
                    className={linkClassName(DRAWER_LINK_CLASS, "/hexagrams")}
                  >
                    {dictionary.nav.hexagrams}
                  </Link>
                  <Link
                    href="/history"
                    aria-current={isCurrentPath("/history") ? "page" : undefined}
                    onClick={() => closeDrawer()}
                    className={linkClassName(DRAWER_LINK_CLASS, "/history")}
                  >
                    {dictionary.nav.history}
                  </Link>
                </div>
              </>
            )}
          </nav>

          {/* Footer inside Drawer */}
          <div className="border-t border-[var(--line)] pt-4">
            <p className="mb-2 px-1 font-mono text-[11px] text-[var(--ink-3)]">{dictionary.nav.languageLabel}</p>
            <LanguageSwitcher
              locale={locale}
              labels={dictionary.language}
              idPrefix="drawer"
              className="w-full"
              fullWidth
              placement="up"
              onNavigate={() => closeDrawer()}
            />
          </div>
            </div>
            </>
          )}
        </div>,
        portalRoot,
      )}
    </header>
  );
}
