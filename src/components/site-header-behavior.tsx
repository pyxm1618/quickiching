"use client";

import { useEffect } from "react";

const ACTIVE_CLASS = "bg-white/[0.05] text-[var(--ink)]";
const FOCUSABLE_SELECTOR = 'a[href]:not([tabindex="-1"]), button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type MenuName = "methods" | "guides";

function menuParts(name: MenuName) {
  const trigger = document.getElementById(`${name}-trig-site`) as HTMLButtonElement | null;
  const menu = document.getElementById(`${name}-menu-site`) as HTMLElement | null;
  const container = document.querySelector<HTMLElement>(`[data-header-menu="${name}"]`);
  const items = menu ? Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')) : [];
  return { trigger, menu, container, items };
}

function setMenuOpen(name: MenuName, open: boolean, focus: "first" | "last" | null = null) {
  const { trigger, menu, items } = menuParts(name);
  if (!trigger || !menu) return;
  trigger.setAttribute("aria-expanded", String(open));
  menu.classList.toggle("hidden", !open);
  menu.classList.toggle("block", open);
  const chevron = trigger.querySelector<HTMLElement>("[data-nav-chevron]");
  chevron?.classList.toggle("rotate-180", open);
  for (const item of items) item.tabIndex = open ? 0 : -1;
  if (open && focus && items.length > 0) {
    requestAnimationFrame(() => (focus === "first" ? items[0] : items.at(-1))?.focus());
  }
}

function closeDesktopMenus() {
  setMenuOpen("methods", false);
  setMenuOpen("guides", false);
}

function visibleFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((node) => {
    const style = window.getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
  });
}

function markCurrentPath(header: HTMLElement) {
  const pathname = window.location.pathname || "/";
  for (const link of header.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    let path: string;
    try {
      path = new URL(link.href, window.location.origin).pathname;
    } catch {
      continue;
    }
    const current = path === pathname;
    if (current) {
      link.setAttribute("aria-current", "page");
      for (const token of ACTIVE_CLASS.split(" ")) link.classList.add(token);
    } else {
      link.removeAttribute("aria-current");
      for (const token of ACTIVE_CLASS.split(" ")) link.classList.remove(token);
    }
  }
  const methodsTrigger = document.getElementById("methods-trig-site");
  const guidesTrigger = document.getElementById("guides-trig-site");
  methodsTrigger?.classList.toggle("text-[var(--ink)]", pathname.startsWith("/methods/"));
  guidesTrigger?.classList.toggle("text-[var(--ink)]", pathname.startsWith("/guides/"));
}

export function SiteHeaderBehavior() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("header[data-site-header]");
    if (!header) return;

    const brand = header.querySelector<HTMLAnchorElement>("[data-header-brand]");
    const drawerTrigger = document.getElementById("drawer-trig-site") as HTMLButtonElement | null;
    const drawerRoot = document.getElementById("nav-drawer-site");
    const drawer = drawerRoot?.querySelector<HTMLElement>("[data-nav-dialog]") ?? null;
    const drawerBackdrop = drawerRoot?.querySelector<HTMLElement>("[data-drawer-backdrop]") ?? null;
    const drawerClose = drawerRoot?.querySelector<HTMLButtonElement>("[data-drawer-close]") ?? null;
    const desktop = window.matchMedia("(min-width: 1024px)");
    let drawerOpen = false;
    let originalOverflow = "";

    markCurrentPath(header);

    function closeDrawer(returnFocus = true) {
      if (!drawerRoot || !drawerTrigger || !drawer) return;
      drawerOpen = false;
      drawerTrigger.setAttribute("aria-expanded", "false");
      drawerRoot.classList.add("hidden");
      drawerRoot.classList.remove("block");
      drawer.removeAttribute("role");
      drawer.removeAttribute("aria-modal");
      document.body.style.overflow = originalOverflow;
      if (returnFocus) requestAnimationFrame(() => drawerTrigger.focus());
    }

    function openDrawer() {
      if (!drawerRoot || !drawerTrigger || !drawer || !drawerClose) return;
      originalOverflow = document.body.style.overflow;
      drawerOpen = true;
      drawerTrigger.setAttribute("aria-expanded", "true");
      drawerRoot.classList.remove("hidden");
      drawerRoot.classList.add("block");
      drawer.setAttribute("role", "dialog");
      drawer.setAttribute("aria-modal", "true");
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => drawerClose.focus());
    }

    function handleMenuTrigger(name: MenuName, event: Event) {
      const { trigger } = menuParts(name);
      if (!trigger) return;
      const other: MenuName = name === "methods" ? "guides" : "methods";
      const open = trigger.getAttribute("aria-expanded") === "true";
      setMenuOpen(other, false);
      setMenuOpen(name, !open);
      event.preventDefault();
    }

    function handleMenuTriggerKey(name: MenuName, event: KeyboardEvent) {
      const { trigger, items } = menuParts(name);
      if (!trigger) return;
      const open = trigger.getAttribute("aria-expanded") === "true";
      const other: MenuName = name === "methods" ? "guides" : "methods";
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(name, false);
      } else if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
        event.preventDefault();
        setMenuOpen(other, false);
        if (open) items[0]?.focus();
        else setMenuOpen(name, true, "first");
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setMenuOpen(other, false);
        if (open) items.at(-1)?.focus();
        else setMenuOpen(name, true, "last");
      }
    }

    function handleMenuItemKey(name: MenuName, event: KeyboardEvent, item: HTMLElement) {
      const { trigger, items } = menuParts(name);
      const index = items.indexOf(item);
      if (index < 0 || !trigger) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(name, false);
        trigger.focus();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
      } else if (event.key === "Tab") {
        setMenuOpen(name, false);
      }
    }

    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      if (!target) return;
      if (target.closest("#methods-trig-site")) return handleMenuTrigger("methods", event);
      if (target.closest("#guides-trig-site")) return handleMenuTrigger("guides", event);
      if (target.closest("#drawer-trig-site")) {
        event.preventDefault();
        openDrawer();
        return;
      }
      if (target.closest("[data-drawer-close]")) {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (target.closest("[data-drawer-backdrop]")) {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (target.closest('[data-header-menu="methods"] [role^="menuitem"]')) setMenuOpen("methods", false);
      if (target.closest('[data-header-menu="guides"] [role^="menuitem"]')) setMenuOpen("guides", false);
      if (drawerOpen && target.closest("#nav-drawer-site a[href]")) closeDrawer(false);
      if (drawerOpen && target.closest('#nav-drawer-site [data-language-switcher] [role="menuitemradio"]')) {
        requestAnimationFrame(() => closeDrawer(false));
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("#methods-trig-site")) return handleMenuTriggerKey("methods", event);
      if (target.closest("#guides-trig-site")) return handleMenuTriggerKey("guides", event);
      const methodsItem = target.closest<HTMLElement>('#methods-menu-site [role^="menuitem"]');
      if (methodsItem) return handleMenuItemKey("methods", event, methodsItem);
      const guidesItem = target.closest<HTMLElement>('#guides-menu-site [role^="menuitem"]');
      if (guidesItem) return handleMenuItemKey("guides", event, guidesItem);

      if (!drawerOpen || !drawer) return;
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        const languageMenuOpen = drawer.querySelector('[data-language-switcher] button[aria-haspopup="menu"][aria-expanded="true"]');
        if (languageMenuOpen) return;
        event.preventDefault();
        closeDrawer();
      } else if (event.key === "Tab") {
        const focusables = visibleFocusable(drawer);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    function onDocumentMouseDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      for (const name of ["methods", "guides"] as const) {
        const { container, trigger } = menuParts(name);
        if (trigger?.getAttribute("aria-expanded") === "true" && container && !container.contains(target)) setMenuOpen(name, false);
      }
    }

    function onBreakpointChange(event: MediaQueryListEvent) {
      if (event.matches) {
        const activeWasInDrawer = Boolean(drawer?.contains(document.activeElement));
        if (drawerOpen) closeDrawer(false);
        if (activeWasInDrawer) requestAnimationFrame(() => brand?.focus());
      } else {
        closeDesktopMenus();
      }
    }

    function onPopState() {
      closeDesktopMenus();
      if (drawerOpen) closeDrawer(false);
      markCurrentPath(header);
    }

    header.addEventListener("click", onClick);
    header.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onDocumentMouseDown);
    desktop.addEventListener("change", onBreakpointChange);
    window.addEventListener("popstate", onPopState);

    return () => {
      header.removeEventListener("click", onClick);
      header.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onDocumentMouseDown);
      desktop.removeEventListener("change", onBreakpointChange);
      window.removeEventListener("popstate", onPopState);
      if (drawerOpen) document.body.style.overflow = originalOverflow;
    };
  }, []);

  return null;
}
