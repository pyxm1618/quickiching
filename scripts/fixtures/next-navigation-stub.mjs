export function useRouter() {
  return {
    refresh() { globalThis.__routerRefreshes = (globalThis.__routerRefreshes ?? 0) + 1; },
    push() {},
    replace() {},
    prefetch() { return Promise.resolve(); },
    back() {},
    forward() {},
  };
}
export function usePathname() { return globalThis.location?.pathname ?? "/"; }
export function useSearchParams() { return new URLSearchParams(globalThis.location?.search ?? ""); }
