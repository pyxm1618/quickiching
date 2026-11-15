/**
 * Navigation / Surface Authority — Context Navigation.
 *
 * Locale switching is a semantic surface operation, not a string replacement:
 * the outer route must land on the equivalent surface, its flow-critical state
 * must survive, and nested return/callback targets must be mapped recursively.
 *
 * The only values that are *transformed* are same-origin internal paths and the
 * two declared semantic context keys (`callbackURL`, `returnUrl`). Everything
 * else is either preserved verbatim or dropped at the outer surface by its
 * declared allowlist. External URLs, opaque identifiers (orderId), analytics
 * params and unsafe callback targets are never rewritten. Full same-origin
 * validation remains with validateAuthCallbackURL on the server.
 */

import type { ContentLocale } from "@/i18n/config";
import { hasPricingFlowContext, normalizeNavigationPath, surfaceIdForPath, type SurfaceId } from "./surface-contract";

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

/** Keys whose value is itself a semantic internal location, mapped recursively. */
const NESTED_CONTEXT_KEYS = new Set(["callbackURL", "returnUrl"]);

/** Guards against malformed/cyclic nesting in untrusted query strings. */
const MAX_CONTEXT_DEPTH = 4;

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

/**
 * Same-origin internal target guard, mirroring the rules of
 * validateAuthCallbackURL (which remains the authoritative server validator).
 * An unsafe target is never locale-mapped: it is left untouched so the server
 * validator can reject it exactly as it does today.
 */
export function isSafeInternalTarget(value: string): boolean {
  if (!value || value.length > 2048 || value.trim() !== value) return false;
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes("\\") || /%(?:25)*(?:5c)/iu.test(value)) return false;
  const splitIndex = value.search(/[?#]/u);
  let pathPart = splitIndex < 0 ? value : value.slice(0, splitIndex);
  try {
    for (let pass = 0; pass < 8; pass += 1) {
      if (pathPart.includes("\\") || pathPart.startsWith("//") || /%(?:25)*(?:2f|5c)/iu.test(pathPart)) return false;
      const next = decodeURIComponent(pathPart);
      if (next === pathPart) return true;
      pathPart = next;
    }
  } catch {
    return false;
  }
  return false;
}

export function localizedSurfaceHref(basePath: string, targetLocale: ContentLocale): string {
  const base = basePath === "/" ? "/" : basePath;
  if (targetLocale === "zh-Hans") return base === "/" ? "/zh" : `/zh${base}`;
  return base;
}

function splitLocation(value: string): { path: string; search: string; hash: string } {
  const hashIndex = value.indexOf("#");
  const hash = hashIndex >= 0 ? value.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const queryIndex = withoutHash.indexOf("?");
  const search = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  return { path, search, hash };
}

/**
 * Maps the search of a *nested* semantic target. Non-semantic keys (session,
 * orderId, analytics params, opaque values) are preserved verbatim; only the
 * two declared nested context keys are recursively mapped. This keeps the exact
 * identity of the nested surface instead of blindly rewriting its query.
 */
function mapNestedSearch(search: string, targetLocale: ContentLocale, depth: number): string {
  if (!search) return "";
  const source = parseParams(search);
  const result = new URLSearchParams();
  for (const [key, value] of source.entries()) {
    result.set(key, NESTED_CONTEXT_KEYS.has(key) ? mapInternalPathLocale(value, targetLocale, depth + 1) : value);
  }
  const serialized = result.toString();
  return serialized ? `?${serialized}` : "";
}

function semanticHash(hash: string): string {
  if (!hash) return "";
  const candidate = hash.startsWith("#") ? hash : `#${hash}`;
  return FRAGMENT_PATTERN.test(candidate) ? candidate : "";
}

/**
 * Maps a same-origin internal path onto the equivalent localized surface,
 * recursively mapping nested `callbackURL` / `returnUrl` targets.
 *
 * External URLs, opaque values and unsafe callback targets are returned
 * untouched. Nested `session` values, semantic fragments and all other nested
 * query identity are preserved verbatim.
 */
export function mapInternalPathLocale(
  value: string,
  targetLocale: ContentLocale,
  depth = 0,
): string {
  if (depth > MAX_CONTEXT_DEPTH) return value;
  if (!isSafeInternalTarget(value)) return value;
  const { path, search, hash } = splitLocation(value);
  const { basePath } = normalizeNavigationPath(path);
  return (
    localizedSurfaceHref(basePath, targetLocale) +
    mapNestedSearch(search, targetLocale, depth) +
    semanticHash(hash)
  );
}

/** Outer surface: only the keys that surface declares are carried across. */
function preservedQuery(
  surfaceId: SurfaceId,
  search: string | undefined,
  targetLocale: ContentLocale,
  paymentRecoveryOrderId?: string,
): string {
  const keys = FLOW_CRITICAL_QUERY[surfaceId];
  if (!keys) return "";
  const source = parseParams(search);
  const result = new URLSearchParams();
  for (const key of keys) {
    const value = source.get(key);
    if (value === null || value === "") continue;
    result.set(key, NESTED_CONTEXT_KEYS.has(key) ? mapInternalPathLocale(value, targetLocale) : value);
  }
  // S16 may carry a payment-recovery order identity, but only after the caller
  // has validated it against the fresh checkout-return context. A query orderId
  // alone is not authority and is therefore dropped by default.
  if (
    surfaceId === "S16"
    && paymentRecoveryOrderId
    && source.get("orderId") === paymentRecoveryOrderId
  ) {
    result.set("orderId", paymentRecoveryOrderId);
  }
  const serialized = result.toString();
  return serialized ? `?${serialized}` : "";
}

function preservedFragment(surfaceId: SurfaceId, hash: string | undefined): string {
  if (!hash || !FRAGMENT_SURFACES.has(surfaceId)) return "";
  return semanticHash(hash);
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
  /** Fresh, matching S16 checkout-recovery identity validated by its owner. */
  paymentRecoveryOrderId?: string;
}): LocaleSwitchTarget {
  const targetLocale: ContentLocale = input.currentLocale === "en" ? "zh-Hans" : "en";
  const { basePath } = normalizeNavigationPath(input.pathname);
  const inferredFlowState = input.flowState ?? (
    hasPricingFlowContext(input.search) ? { pricingReadingContext: true } : undefined
  );
  const surfaceId = surfaceIdForPath(input.pathname, inferredFlowState);
  if (surfaceId === "S20" || surfaceId === "S21") {
    return { href: localizedSurfaceHref(basePath, targetLocale), available: false };
  }
  const href =
    localizedSurfaceHref(basePath, targetLocale) +
    preservedQuery(surfaceId, input.search, targetLocale, input.paymentRecoveryOrderId) +
    preservedFragment(surfaceId, input.hash);
  return { href, available: true };
}

/**
 * Return target used by the account capability.
 *
 * Preserves the same flow-critical state the locale switch preserves, so a
 * visitor who signs in from a sealed reading returns to that reading instead of
 * the home page. Nested targets stay inside the current locale. Security
 * validation stays with validateAuthCallbackURL.
 */
export function authCallbackPath(input: {
  pathname: string;
  search?: string;
  hash?: string;
}): string {
  const surfaceId = surfaceIdForPath(
    input.pathname,
    hasPricingFlowContext(input.search) ? { pricingReadingContext: true } : undefined,
  );
  const keys = FLOW_CRITICAL_QUERY[surfaceId];
  if (!keys) return `${input.pathname}${preservedFragment(surfaceId, input.hash)}`;
  const source = parseParams(input.search);
  const result = new URLSearchParams();
  for (const key of keys) {
    const value = source.get(key);
    if (value === null || value === "") continue;
    result.set(key, value);
  }
  const serialized = result.toString();
  return `${input.pathname}${serialized ? `?${serialized}` : ""}${preservedFragment(surfaceId, input.hash)}`;
}

/** Locale-aware home target owned by the shell brand. */
export function shellHomeTarget(locale: ContentLocale): string {
  return locale === "zh-Hans" ? "/zh" : "/";
}
