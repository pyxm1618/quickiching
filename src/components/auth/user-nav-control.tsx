"use client";

import React, { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Settings, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { getDictionary } from "@/i18n/dictionaries";
import type { ContentLocale } from "@/i18n/config";
import { openAccountSurface, type AccountSurface } from "@/components/account/account-events";
import "@/components/account/account.css";

export type UserNavControlProps = {
  initialUser?: { id: string; email: string } | null;
  isMobileDrawer?: boolean;
  hideUnauthenticated?: boolean;
  onItemClick?: () => void;
  locale?: ContentLocale;
  initialOpen?: boolean;
};

type UserState = {
  id: string;
  email: string;
} | null;

export function UserNavControl({
  initialUser,
  isMobileDrawer = false,
  hideUnauthenticated = false,
  onItemClick,
  locale = "en",
  initialOpen = false,
}: UserNavControlProps) {
  const dictionary = getDictionary(locale);
  const copy = dictionary.userNav;
  const isChinese = locale === "zh-Hans";
  const pathname = usePathname() ?? "/";
  const shouldFetchUser = initialUser === undefined;
  const { data: userResponse, isLoading: userLoading } = useSWR<{ user: UserState }>(
    shouldFetchUser ? "/api/user/me" : null,
    async (url: string) => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("USER_SESSION_UNAVAILABLE");
      return res.json() as Promise<{ user: UserState }>;
    },
    { revalidateOnFocus: false },
  );
  const user = initialUser !== undefined ? initialUser : userResponse?.user ?? null;
  const loading = shouldFetchUser && userLoading;
  const [isOpen, setIsOpen] = useState(initialOpen);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<Array<HTMLElement | null>>([]);

  function focusMenuItem(index: number) {
    requestAnimationFrame(() => menuItemRefs.current[index]?.focus());
  }

  function handleMenuTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      focusMenuItem(event.key === "ArrowDown" ? 0 : 2);
    }
  }

  function handleMenuItemKeyDown(event: React.KeyboardEvent<HTMLElement>, index: number) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      requestAnimationFrame(() => menuTriggerRef.current?.focus());
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next = (index + direction + menuItemRefs.current.length) % menuItemRefs.current.length;
      menuItemRefs.current[next]?.focus();
    } else if (event.key === "Tab") {
      setIsOpen(false);
    }
  }

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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

  function openModal(surface: AccountSurface) {
    setIsOpen(false);
    onItemClick?.();
    requestAnimationFrame(() => openAccountSurface(surface));
  }

  const authPrefix = isChinese ? "/zh" : "";
  const signinHref = `${authPrefix}/signin?callbackURL=${encodeURIComponent(pathname)}`;
  const signupHref = `${authPrefix}/signup?callbackURL=${encodeURIComponent(pathname)}`;
  const readingsHref = `${authPrefix}/my-readings`;
  const readingsLabel = isChinese ? "我的解读" : "My Readings";
  const accountLabel = isChinese ? "我的账户" : "My Account";
  const settingsLabel = isChinese ? "设置" : "Settings";

  if (loading) {
    if (hideUnauthenticated && !isMobileDrawer) {
      return <div className="h-11 w-11 shrink-0" aria-hidden="true" />;
    }
    return (
      <div
        className={isMobileDrawer
          ? "mt-2 h-[4.25rem] border-t border-white/[0.08] pt-3"
          : "inline-flex min-h-11 w-[9.75rem] items-center rounded-lg"}
        aria-hidden="true"
      >
        <div className={isMobileDrawer ? "h-11 w-full animate-pulse rounded-xl bg-white/[0.06]" : "h-8 w-full animate-pulse rounded-lg bg-white/[0.06]"} />
      </div>
    );
  }

  // 1. 移动端抽屉布局
  if (isMobileDrawer) {
    if (!user) {
      return (
        <div className="mt-2 border-t border-white/[0.08] pt-3">
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={signinHref}
              prefetch={false}
              onClick={onItemClick}
              className="flex min-h-11 items-center justify-center rounded-xl border border-white/[0.12] px-4 py-2.5 text-sm font-medium text-[var(--ink-2)] transition-colors hover:border-[var(--gold)]/40 hover:bg-white/[0.06] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
            >
              {copy.signIn}
            </Link>
            <Link
              href={signupHref}
              prefetch={false}
              onClick={onItemClick}
              className="flex min-h-11 items-center justify-center rounded-xl border border-[var(--gold)]/35 bg-[var(--gold)]/12 px-4 py-2.5 text-sm font-semibold text-[var(--gold-2)] transition-colors hover:bg-[var(--gold)]/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
            >
              {copy.signUp}
            </Link>
          </div>
        </div>
      );
    }

    const initial = user.email.charAt(0).toUpperCase();

    return (
      <div className="border-t border-white/[0.08] pt-4 mt-3">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--gold)]/40 bg-[var(--gold)]/15 text-sm font-semibold text-[var(--gold-2)] shadow-sm">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-[var(--ink)]">{user.email}</p>
            <p className="text-[10px] text-[var(--jade)]">{copy.activeAccount}</p>
          </div>
        </div>

        <div className="qic-account-mobile-menu">
          <Link href={readingsHref} prefetch={false} onClick={onItemClick}><FileText aria-hidden="true" />{readingsLabel}</Link>
          <button onClick={() => openModal("account")}><User aria-hidden="true" />{accountLabel}</button>
          <button onClick={() => openModal("settings")}><Settings aria-hidden="true" />{settingsLabel}</button>
        </div>
      </div>
    );
  }

  // 2. 桌面端顶部导航布局
  if (!user && hideUnauthenticated) return null;

  if (!user) {
    return (
      <div className="inline-flex items-center gap-2">
        <Link
          href={signinHref}
          prefetch={false}
          className="inline-flex min-h-11 items-center rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[var(--ink-2)] transition-colors hover:bg-white/[0.05] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
              {copy.signIn}
            </Link>
        <Link
          href={signupHref}
          prefetch={false}
          className="inline-flex min-h-11 items-center rounded-lg border border-[var(--gold)]/35 bg-[var(--gold)]/10 px-3 py-1.5 text-[13px] font-semibold text-[var(--gold-2)] transition-colors hover:bg-[var(--gold)]/16 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
              {copy.signUp}
            </Link>
      </div>
    );
  }

  const initial = user.email.charAt(0).toUpperCase();

  return (
    <div className="relative inline-flex items-center" ref={menuRef}>
      <button
        ref={menuTriggerRef}
        type="button"
        data-user-nav-menu-button
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleMenuTriggerKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={copy.menuAria.replace("{email}", user.email)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] py-1 pl-1.5 pr-2.5 transition-all hover:border-[var(--gold)]/40 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)] cursor-pointer"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--gold)]/40 bg-[var(--gold)]/20 text-xs font-semibold text-[var(--gold-2)] shadow-sm">
          {initial}
        </div>
        <span className="max-w-[120px] truncate text-xs font-medium text-[var(--ink-2)]">
          {user.email.split("@")[0]}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-[var(--ink-3)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div role="menu" data-user-nav-dropdown className="qic-user-menu">
          <div className="qic-user-menu-identity"><span aria-hidden="true">{initial}</span><p title={user.email}>{user.email}</p></div>
          <div className="qic-user-menu-divider" aria-hidden="true">☯</div>
          <Link ref={(node) => { menuItemRefs.current[0] = node; }} href={readingsHref} prefetch={false} role="menuitem" onKeyDown={(event) => handleMenuItemKeyDown(event, 0)} onClick={() => setIsOpen(false)}><FileText aria-hidden="true" /><span>{readingsLabel}</span><ChevronRight aria-hidden="true" /></Link>
          <button ref={(node) => { menuItemRefs.current[1] = node; }} role="menuitem" onKeyDown={(event) => handleMenuItemKeyDown(event, 1)} onClick={() => openModal("account")}><User aria-hidden="true" /><span>{accountLabel}</span><ChevronRight aria-hidden="true" /></button>
          <button ref={(node) => { menuItemRefs.current[2] = node; }} role="menuitem" onKeyDown={(event) => handleMenuItemKeyDown(event, 2)} onClick={() => openModal("settings")}><Settings aria-hidden="true" /><span>{settingsLabel}</span><ChevronRight aria-hidden="true" /></button>
        </div>
      )}
    </div>
  );
}
