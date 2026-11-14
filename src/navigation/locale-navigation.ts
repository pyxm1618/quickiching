/**
 * Navigation / Surface Authority — Context Navigation.
 *
 * Locale switching is a surface operation, not a string replacement: the outer
 * route must land on the equivalent surface, the flow-critical state of that
 * surface must survive, and nested return targets must be mapped as well.
 *
 * Explicitly NOT preserved:
 *   - external URLs (only same-site absolute paths are mapped)
 *   - orderId and other opaque transaction identifiers
 *   - any query key that no surface declares below
 */

import type { ContentLocale } from "@/i18n/config";
import { normalizeNavigationPath, surfaceIdForPath, type SurfaceId } from "./surface-contract";

/** Query keys that carry meaning for a surface and must survive a locale switch. */
const FLOW_CRITICAL_QUERY: Partial<Record<SurfaceId, readonly string[]>> = {
  S12: ["session"],
  S13: ["session"],
  S14: ["session"],
  S15: ["returnUrl"],
  S16: ["returnUrl"],
  S17: ["callbackURL"],
  S18: ["callbackURL"],
};

/**
 * Surfaces whose stable fragment identifies a real section of the equivalent
 * localized surface. Hexagram line anchors are identical in both locales.
 */
const FRAGMENT_SURFACES = new Set<SurfaceId>(["S04", "S09", "S10", "S11"]);

const FRAGMENT_PATTERN = /^#[A-Za-z][\w:-]{0,64}$/u;

function parseParams(search: string | undefined): URLSearchParams {
  if (!search) return new URLSearchParams();
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

function isInternalPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}

export function localizedSurfaceHref(basePath: string, targetLocale: ContentLocale): string {
  const base = basePath === "/" ? "/" : basePath;
  if (targetLocale === "zh-Hans") return base === "/" ? "/zh" : `/zh${base}`;
  return base;
}

/**
 * Maps an internal path (optionally carrying its own query and fragment) onto
 * the equivalent localized surface. External targets and opaque values are
 * returned untouched.
 */
export function mapInternalPathLocale(value: string, targetLocale: ContentLocale): string {
  if (!isInternalPath(value)) return value;
  const splitIndex = value.search(/[?#]/u);
  const pathPart = splitIndex < 0 ? value : value.slice(0, splitIndex);
  const rest = splitIndex < 0 ? "" : value.slice(splitIndex);
  const { basePath } = normalizeNavigationPath(pathPart);
  return `${localizedSurfaceHref(basePath, targetLocale)}${rest}`;
}

function preservedQuery(surfaceId: SurfaceId, search: string | undefined, targetLocale: ContentLocale): string {
  const keys = FLOW_CRITICAL_QUERY[surfaceId];
  if (!keys) return "";
  const source = parseParams(search);
  const result = new URLSearchParams();
  for (const key of keys) {
    const value = source.get(key);
    if (value === null || value === "") continue;
    result.set(key, key === "returnUrl" || key === "callbackURL" ? mapInternalPathLocale(value, targetLocale) : value);
  }
  const serialized = result.toString();
  return serialized ? `?${serialized}` : "";
}

function preservedFragment(surfaceId: SurfaceId, hash: string | undefined): string {
  if (!hash || !FRAGMENT_SURFACES.has(surfaceId)) return "";
  const candidate = hash.startsWith("#") ? hash : `#${hash}`;
  return FRAGMENT_PATTERN.test(candidate) ? candidate : "";
}

export type LocaleSwitchTarget = {
  href: string;
  available: boolean;
};

/**
 * Semantic locale target for the current surface.
 *
 * A surface without a locale counterpart reports `available: false` so the
 * shell renders an indicator instead of inventing a Home fallback.
 */
export function localeSwitchTarget(input: {
  pathname: string;
  search?: string;
  hash?: string;
  currentLocale: ContentLocale;
  flowState?: Parameters<typeof surfaceIdForPath>[1];
}): LocaleSwitchTarget {
  const targetLocale: ContentLocale = input.currentLocale === "en" ? "zh-Hans" : "en";
  const { basePath } = normalizeNavigationPath(input.pathname);
  const surfaceId = surfaceIdForPath(input.pathname, input.flowState);
  if (surfaceId === "S20" || surfaceId === "S21") {
    return { href: localizedSurfaceHref(basePath, targetLocale), available: false };
  }
  const href =
    localizedSurfaceHref(basePath, targetLocale) +
    preservedQuery(surfaceId, input.search, targetLocale) +
    preservedFragment(surfaceId, input.hash);
  return { href, available: true };
}

/**
 * Return target used by the account capability.
 *
 * Preserves the same flow-critical state the locale switch preserves, so a
 * visitor who signs in from a sealed reading returns to that reading instead of
 * the home page. Security validation stays with validateAuthCallbackURL.
 */
export function authCallbackPath(input: {
  pathname: string;
  search?: string;
  hash?: string;
}): string {
  const surfaceId = surfaceIdForPath(input.pathname);
  const query = input.search ?? "";
  const keys = FLOW_CRITICAL_QUERY[surfaceId];
  if (!keys) return `${input.pathname}${preservedFragment(surfaceId, input.hash)}`;
  const source = parseParams(query);
  const result = new URLSearchParams();
  for (const key of keys) {
    const value = source.get(key);
    if (value === null || value === "") continue;
    // The callback target stays inside the current locale; nested targets are
    // preserved verbatim because they already point at a concrete surface.
    result.set(key, value);
  }
  const serialized = result.toString();
  return `${input.pathname}${serialized ? `?${serialized}` : ""}${preservedFragment(surfaceId, input.hash)}`;
}

/** Locale-aware home target owned by the shell brand. */
export function shellHomeTarget(locale: ContentLocale): string {
  return locale === "zh-Hans" ? "/zh" : "/";
}
