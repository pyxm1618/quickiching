"use client";

import React, { Suspense, useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * One shared, reactive location context for every shell-owned navigation
 * control. Locale targets and auth callback targets must never be computed from
 * three independent snapshots of the URL: a same-path query change, a hash
 * change, or a back/forward transition has to refresh all of them together.
 */
export type NavigationLocation = {
  pathname: string;
  search: string;
  hash: string;
};

const EMPTY: NavigationLocation = Object.freeze({ pathname: "/", search: "", hash: "" });

let snapshot: NavigationLocation = EMPTY;
const listeners = new Set<() => void>();

function readWindow(): NavigationLocation {
  if (typeof window === "undefined") return snapshot;
  return {
    pathname: window.location.pathname || "/",
    search: window.location.search || "",
    hash: window.location.hash || "",
  };
}

export function publishNavigationLocation(next: NavigationLocation): void {
  const current = snapshot;
  if (
    current.pathname === next.pathname &&
    current.search === next.search &&
    current.hash === next.hash
  ) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

export function subscribeNavigationLocation(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNavigationLocationSnapshot(): NavigationLocation {
  return snapshot;
}

function getServerSnapshot(): NavigationLocation {
  return EMPTY;
}

/**
 * Keeps the store reactive to Next's client-side navigation (including a
 * same-path query change) and to native history/hash events. It renders
 * nothing; it is deliberately inside its own Suspense boundary so the shell
 * itself stays server-renderable on static routes.
 */
function LocationSync(): null {
  const searchParams = useSearchParams();

  useEffect(() => {
    publishNavigationLocation(readWindow());
  }, [searchParams]);

  useEffect(() => {
    const sync = () => publishNavigationLocation(readWindow());
    const onVisibility = () => {
      if (!document.hidden) sync();
    };
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    window.addEventListener("pageshow", sync);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("pageshow", sync);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}

export function NavigationLocationProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <LocationSync />
      </Suspense>
      {children}
    </>
  );
}

/**
 * Single source of truth for shell navigation context.
 *
 * `usePathname()` is the authoritative pathname (reactive to router state, also
 * in component tests). Query and fragment come from the shared reactive store,
 * which is refreshed by router state, popstate, hashchange and frame polling.
 */
export function useNavigationLocation(): NavigationLocation {
  const routerPathname = usePathname() ?? "/";
  const reactive = useSyncExternalStore(subscribeNavigationLocation, getNavigationLocationSnapshot, getServerSnapshot);
  return useMemo(
    () => ({
      pathname: routerPathname,
      search: reactive.search,
      hash: reactive.hash,
    }),
    [routerPathname, reactive.search, reactive.hash],
  );
}
