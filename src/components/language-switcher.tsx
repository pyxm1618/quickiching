"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, ChevronDown, Check } from "lucide-react";
import { currentRouteForPath, languageSwitchTarget } from "@/i18n/helpers";
import type { ContentLocale } from "@/i18n/config";

export type LanguageLabels = {
  switchToChinese: string;
  switchToEnglish: string;
  chineseHome: string;
  englishHome?: string;
  currentLanguage?: string;
  selectLanguage?: string;
};

export type LanguageSwitcherProps = {
  locale: ContentLocale;
  labels: LanguageLabels;
  idPrefix?: string;
  className?: string;
  fullWidth?: boolean;
  placement?: "down" | "up";
  onNavigate?: () => void;
};

export function LanguageSwitcher({
  locale,
  labels,
  idPrefix,
  className = "",
  fullWidth = false,
  placement = "down",
  onNavigate,
}: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rawId = useId();
  const sanitizedId = (idPrefix ? `${idPrefix}-${rawId}` : rawId).replace(/[^a-zA-Z0-9-_]/g, "");
  const triggerId = `lang-trigger-${sanitizedId}`;
  const menuId = `lang-menu-${sanitizedId}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const focusRequestRef = useRef<"first" | "last" | null>(null);

  const pathname = usePathname() ?? "/";
  const route = currentRouteForPath(pathname);
  const target = route
    ? languageSwitchTarget(route.id, locale)
    : locale === "en"
      ? { href: "/zh", label: labels.chineseHome, equivalent: false }
      : { href: "/", label: labels.englishHome ?? labels.switchToEnglish, equivalent: false };

  const currentLabel = labels.currentLanguage ?? (locale === "en" ? "English" : "简体中文");
  const targetLanguageLabel = locale === "en" ? labels.switchToChinese : labels.switchToEnglish;
  const targetLabel = target.equivalent ? targetLanguageLabel : target.label;

  useEffect(() => {
    if (!isOpen || !focusRequestRef.current) return;
    const request = focusRequestRef.current;
    focusRequestRef.current = null;
    const frame = requestAnimationFrame(() => {
      itemRefs.current[request === "first" ? 0 : 1]?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Escape") {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    } else if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      if (isOpen) {
        itemRefs.current[0]?.focus();
      } else {
        focusRequestRef.current = "first";
        setIsOpen(true);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isOpen) {
        itemRefs.current[1]?.focus();
      } else {
        focusRequestRef.current = "last";
        setIsOpen(true);
      }
    }
  };

  const handleItemKeyDown = (e: KeyboardEvent, index: number) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if ((e.key === "Enter" || e.key === " ") && index === 0) {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (index + 1) % 2;
      itemRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (index - 1 + 2) % 2;
      itemRefs.current[prev]?.focus();
    } else if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      const modal = containerRef.current?.closest('[role="dialog"][aria-modal="true"]');
      const scope = modal ?? document.body;
      const focusables = Array.from(scope.querySelectorAll<HTMLElement>(
        'a[href]:not([tabindex="-1"]), button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((node) => {
        const style = window.getComputedStyle(node);
        return node !== e.currentTarget && (!containerRef.current?.contains(node) || node === triggerRef.current) && style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
      });
      const triggerIndex = focusables.indexOf(triggerRef.current as HTMLElement);
      const nextIndex = e.shiftKey ? triggerIndex - 1 : triggerIndex + 1;
      const target = focusables.length > 0
        ? focusables[(nextIndex + focusables.length) % focusables.length]
        : triggerRef.current;
      setIsOpen(false);
      requestAnimationFrame(() => target?.focus());
    }
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`} data-language-switcher>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={labels.selectLanguage ?? (locale === "en" ? "Select language" : "选择语言")}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.04] px-3.5 py-1.5 text-[13px] font-medium text-[var(--ink-2)] transition-all hover:border-[var(--line-strong)] hover:bg-white/[0.08] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cinnabar)] cursor-pointer ${fullWidth ? "w-full justify-between" : ""}`}
      >
        <Globe className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
        <span>{currentLabel}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 opacity-60 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      <div
        id={menuId}
        role="menu"
        aria-labelledby={triggerId}
        className={`absolute right-0 z-50 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-1 shadow-lg backdrop-blur-md focus:outline-none ${placement === "up" ? "bottom-full mb-1.5 origin-bottom-right" : "top-full mt-1.5 origin-top-right"} ${fullWidth ? "w-full min-w-0" : "min-w-[140px]"} ${isOpen ? "block" : "hidden"}`}
      >
        {/* Current language item */}
        <button
          type="button"
          ref={(el) => { itemRefs.current[0] = el; }}
          role="menuitemradio"
          aria-checked="true"
          tabIndex={isOpen ? 0 : -1}
          aria-current="page"
          onClick={() => {
            setIsOpen(false);
            triggerRef.current?.focus();
          }}
          onKeyDown={(e) => handleItemKeyDown(e, 0)}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-semibold text-[var(--ink)] focus:bg-white/[0.1] focus:outline-none"
        >
          <span>{currentLabel}</span>
          <Check className="h-3.5 w-3.5 text-[var(--cinnabar)] shrink-0" aria-hidden="true" />
        </button>

        {/* Target language link item */}
        <Link
          ref={(el) => { itemRefs.current[1] = el; }}
          href={target.href}
          role="menuitemradio"
          aria-checked="false"
          tabIndex={isOpen ? 0 : -1}
          data-language-switch
          data-equivalent={target.equivalent ? "true" : "false"}
          onClick={() => {
            setIsOpen(false);
            onNavigate?.();
          }}
          onKeyDown={(e) => handleItemKeyDown(e, 1)}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs text-[var(--ink-2)] transition-colors hover:bg-white/[0.08] hover:text-[var(--ink)] focus:bg-white/[0.1] focus:text-[var(--ink)] focus:outline-none"
        >
          <span>{targetLabel}</span>
        </Link>
      </div>
    </div>
  );
}
