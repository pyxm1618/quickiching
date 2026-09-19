"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, LogOut, FileText, ChevronDown } from "lucide-react";

export type UserNavControlProps = {
  initialUser?: { id: string; email: string } | null;
  isMobileDrawer?: boolean;
  onItemClick?: () => void;
};

type UserState = {
  id: string;
  email: string;
} | null;

export function UserNavControl({
  initialUser,
  isMobileDrawer = false,
  onItemClick,
}: UserNavControlProps) {
  const pathname = usePathname() ?? "/";
  const [user, setUser] = useState<UserState>(initialUser !== undefined ? initialUser : null);
  const [loading, setLoading] = useState(initialUser === undefined);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialUser !== undefined) return;
    let active = true;
    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json() as { user: UserState };
          if (active) setUser(data.user);
        }
      } catch {
        // 忽略探测异常
      } finally {
        if (active) setLoading(false);
      }
    }
    void fetchUser();
    return () => {
      active = false;
    };
  }, [pathname, initialUser]);

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

  async function handleSignOut() {
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // 降级刷新
    }
    window.location.assign("/");
  }

  const signinHref = `/signin?callbackURL=${encodeURIComponent(pathname)}`;

  if (loading) {
    return (
      <div className={isMobileDrawer ? "py-2" : "inline-flex items-center"}>
        <div className="h-8 w-8 animate-pulse rounded-full bg-white/[0.08]" />
      </div>
    );
  }

  // 1. 移动端抽屉布局
  if (isMobileDrawer) {
    if (!user) {
      return (
        <div className="border-t border-white/[0.08] pt-3 mt-2">
          <Link
            href={signinHref}
            onClick={onItemClick}
            className="flex min-h-11 items-center justify-center rounded-xl bg-white/[0.08] px-4 py-2.5 text-sm font-medium text-[var(--gold-2)] transition-colors hover:bg-white/[0.14]"
          >
            Sign In
          </Link>
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
            <p className="text-[10px] text-[var(--jade)]">Active Account</p>
          </div>
        </div>

        <div className="space-y-1">
          <Link
            href="/account"
            onClick={onItemClick}
            className="flex min-h-11 items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--ink-2)] transition-colors hover:bg-white/[0.08] hover:text-[var(--ink)]"
          >
            <User className="h-4 w-4 text-[var(--gold)]" />
            <span>My Account & History</span>
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--danger)] transition-colors hover:bg-white/[0.08]"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. 桌面端顶部导航布局
  if (!user) {
    return (
      <Link
        href={signinHref}
        className="relative min-h-11 inline-flex items-center rounded-lg border border-white/[0.14] bg-white/[0.04] px-3 py-1.5 text-[13px] font-medium text-[var(--ink-2)] transition-colors hover:border-[var(--gold)]/50 hover:bg-white/[0.08] hover:text-[var(--gold-2)]"
      >
        Sign In
      </Link>
    );
  }

  const initial = user.email.charAt(0).toUpperCase();

  return (
    <div className="relative inline-flex items-center" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`User menu for ${user.email}`}
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
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-white/[0.12] bg-[#120f1d]/95 p-2 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3 py-2 border-b border-white/[0.08] mb-1">
            <p className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--ink-3)]">Signed in as</p>
            <p className="truncate text-xs font-medium text-[var(--ink)] mt-0.5" title={user.email}>
              {user.email}
            </p>
          </div>

          <Link
            href="/account"
            role="menuitem"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--ink-2)] transition-colors hover:bg-white/[0.08] hover:text-[var(--gold-2)]"
          >
            <User className="h-3.5 w-3.5 text-[var(--gold)]" />
            <span>My Account</span>
          </Link>

          <Link
            href="/history"
            role="menuitem"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--ink-2)] transition-colors hover:bg-white/[0.08] hover:text-[var(--ink)]"
          >
            <FileText className="h-3.5 w-3.5 text-[var(--ink-3)]" />
            <span>Local History</span>
          </Link>

          <div className="my-1 border-t border-white/[0.08]" />

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--danger)] transition-colors hover:bg-white/[0.08] cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
