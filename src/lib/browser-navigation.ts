/**
 * C5 — Navigation Context Authority: the single URL transformation owner.
 *
 * Locale switching must preserve the exact user context, not merely the
 * pathname. This module owns every locale-context transformation:
 *
 *   - outer location: pathname + search + hash, never pathname alone;
 *   - nested navigation context: only `callbackURL` and `returnUrl`, a closed
 *     allowlist, with bounded nested depth (callbackURL → returnUrl) and a
 *     fail-safe that preserves the original nested value byte-for-byte;
 *   - opaque values (orderId, requestId, productKey, tokens, arbitrary params)
 *     are never rewritten — unrelated outer query segments keep their original
 *     bytes and order (minimal query surgery);
 *   - external URLs and unsafe targets are never locale-translated.
 *
 * Route EN/ZH equivalence comes only from the authoritative route registry
 * (`@/i18n/routes`); nothing in this module hardcodes a second route map.
 * Security validation of callbackURL/returnUrl stays with the server-side
 * `validateAuthCallbackURL`; this module never widens what that validator
 * accepts — a translated target is still an internal same-origin path.
 */

import { useEffect, useState, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ContentLocale } from "@/i18n/config";
import { routeForPath } from "@/i18n/routes";
import {
  getLiveFlowRegistration,
  issueLocaleContinuationIntent,
} from "@/lib/reading-resume";
import type { PublicReadingMethod } from "@/domain/public-reading/types";

/** Closed allowlist: the only query keys whose values are locale-translated. */
const NESTED_CONTEXT_KEYS = new Set(["callbackURL", "returnUrl"]);

/**
 * Bounded nested depth: `callbackURL` (depth 1) → `returnUrl` (depth 2) is the
 * deepest chain the real product carries. Anything deeper is fail-safe
 * preserved exactly as authored; the transform never recurses without bound.
 */
export const MAX_NESTED_CONTEXT_DEPTH = 2;

function decodeQueryComponent(raw: string): string | null {
  try {
    // Query-value semantics (what URLSearchParams and the server see): a
    // literal plus decodes to a space, then a single percent-decode pass.
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return null;
  }
}

/**
 * Same-origin internal-target guard mirroring the rules of the server-side
 * `validateAuthCallbackURL`, which remains the authoritative validator. An
 * unsafe target is never locale-mapped: it is preserved so the server
 * validator can reject it exactly as it does today.
 */
export function isSafeInternalTarget(value: string): boolean {
  if (!value || value.length > 2048 || value.trim() !== value) return false;
  if (value.includes("\\") || /%(?:25)*(?:5c)/iu.test(value)) return false;
  const logical = decodeQueryComponent(value);
  if (logical === null) return false;
  if (!logical.startsWith("/") || logical.startsWith("//")) return false;
  if (logical.includes("\\")) return false;
  const splitIndex = logical.search(/[?#]/u);
  let pathPart = splitIndex < 0 ? logical : logical.slice(0, splitIndex);
  for (let pass = 0; pass < 8; pass += 1) {
    if (pathPart.includes("\\") || pathPart.startsWith("//") || /%(?:25)*(?:2f|5c)/iu.test(pathPart)) return false;
    let next: string;
    try {
      next = decodeURIComponent(pathPart);
    } catch {
      return false;
    }
    if (next === pathPart) return true;
    pathPart = next;
  }
  return false;
}

type RawMarker = { index: number; length: number; token: string };

const NESTED_MARKER_PATTERN = /[#?]|%3f|%23/iu;

function earliestMarker(raw: string, pattern: RegExp): RawMarker | null {
  // A non-global regex's exec() returns the leftmost match — the earliest
  // location marker in the raw value — exactly once. No iteration, no shared
  // lastIndex state.
  const match = pattern.exec(raw);
  return match === null
    ? null
    : { index: match.index, length: match[0].length, token: match[0] };
}

function rawPathUsesEncodedSlashes(rawPath: string): boolean {
  return /%2f/iu.test(rawPath);
}

function reencodePathPreservingStyle(rawPath: string, targetPath: string): string {
  if (rawPathUsesEncodedSlashes(rawPath)) return encodeURIComponent(targetPath);
  return targetPath;
}

/**
 * Locale-transform one query-parameter segment while preserving every
 * unmodified byte. Only the closed allowlist keys (`callbackURL`,
 * `returnUrl`) are transformed; the key text, the separator style, and all
 * other segments (opaque or arbitrary) stay exactly as authored.
 */
function transformQueryParamSegment(segment: string, targetLocale: ContentLocale, nestedValueDepth: number): string {
  const eq = earliestMarker(segment, /=|%3d/iu);
  if (eq === null) return segment;
  const keyRaw = segment.slice(0, eq.index);
  const separator = segment.slice(eq.index, eq.index + eq.length);
  const valueRaw = segment.slice(eq.index + eq.length);
  const key = decodeQueryComponent(keyRaw);
  if (key === null || !NESTED_CONTEXT_KEYS.has(key)) return segment;
  return keyRaw + separator + transformNestedNavigationContext(valueRaw, targetLocale, nestedValueDepth);
}

/**
 * Locale-transform the query part of a raw location (with its original leading
 * marker), splitting on the query separators at this encoding level and
 * preserving delimiter and segment bytes.
 */
function transformSearchRaw(markerAndSearch: string, targetLocale: ContentLocale, nestedValueDepth: number): string {
  if (!markerAndSearch) return markerAndSearch;
  const marker = earliestMarker(markerAndSearch, /[?]|%3f/iu);
  if (marker === null || marker.index !== 0) return markerAndSearch;
  const queryRaw = markerAndSearch.slice(marker.length);
  if (!queryRaw) return markerAndSearch;
  const parts = queryRaw.split(/(&|%26)/iu);
  const rebuilt = parts.map((part, index) => {
    if (index % 2 === 1) return part;
    return transformQueryParamSegment(part, targetLocale, nestedValueDepth);
  });
  return marker.token + rebuilt.join("");
}

/**
 * Maps a same-origin internal nested navigation-context value
 * (`callbackURL` / `returnUrl`) onto the equivalent localized surface while
 * preserving its nested query identity (session, opaque params) and its
 * nested hash.
 *
 * Fail-safe contract: unless the value is an internal same-origin path whose
 * route is recognized and pairable in the route registry, the ORIGINAL value
 * is returned with its bytes untouched. An unknown nested route is never
 * mapped to the locale root and a parse failure never drops the callback.
 */
export function transformNestedNavigationContext(
  rawValue: string,
  targetLocale: ContentLocale,
  depth = 1,
): string {
  if (depth > MAX_NESTED_CONTEXT_DEPTH) return rawValue;
  if (!isSafeInternalTarget(rawValue)) return rawValue;

  const pathMarker = earliestMarker(rawValue, NESTED_MARKER_PATTERN);
  const rawPath = pathMarker === null ? rawValue : rawValue.slice(0, pathMarker.index);
  const rest = pathMarker === null ? "" : rawValue.slice(pathMarker.index);

  const logicalPath = decodeQueryComponent(rawPath);
  if (logicalPath === null) return rawValue;
  const route = routeForPath(logicalPath);
  if (!route) return rawValue;
  const targetPath = route.paths[targetLocale];
  if (!targetPath || route.renderable[targetLocale] !== true || !route.switchable) return rawValue;

  const newPathRaw = reencodePathPreservingStyle(rawPath, targetPath);
  if (!rest) return newPathRaw;

  // The rest carries the nested query and/or the nested hash. The nested hash
  // (authored as %23 inside the value — an unencoded # would be the outer
  // hash) is preserved verbatim; only the nested query may carry deeper
  // context keys, which are transformed at the bounded depth.
  const hashMarker = earliestMarker(rest, /#|%23/iu);
  const searchPart = hashMarker === null ? rest : rest.slice(0, hashMarker.index);
  const hashPart = hashMarker === null ? "" : rest.slice(hashMarker.index);
  return newPathRaw + transformSearchRaw(searchPart, targetLocale, depth + 1) + hashPart;
}

/**
 * Outer query surgery: transform only `callbackURL` / `returnUrl` values and
 * keep every other segment byte-identical, so opaque tokens, parameter order
 * and encoding of unrelated parameters never change.
 */
function transformOuterSearch(search: string, targetLocale: ContentLocale): string {
  return transformSearchRaw(search, targetLocale, 1);
}

function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  if (pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function localeRoot(targetLocale: ContentLocale): string {
  return targetLocale === "zh-Hans" ? "/zh" : "/";
}

export type BrowserLocation = {
  pathname: string;
  search: string;
  hash: string;
};

/**
 * Full-context locale-switch href: the exact semantic surface plus every
 * flow-critical byte of the current outer query and hash. Transactional
 * surfaces resolve through the route registry; an unmatched outer path has no
 * declared equivalent and falls back to the target locale root.
 */
export function buildLocaleSwitchHref(input: BrowserLocation & { targetLocale: ContentLocale }): string {
  const pathname = normalizePathname(input.pathname);
  const route = routeForPath(pathname);
  const targetPath = route
    ? route.renderable[input.targetLocale] === true && route.switchable
      ? route.paths[input.targetLocale]
      : undefined
    : undefined;
  const outPath = targetPath ?? localeRoot(input.targetLocale);
  return outPath + transformOuterSearch(input.search ?? "", input.targetLocale) + (input.hash ?? "");
}

/**
 * The full originating context for authentication return: pathname + search +
 * hash encoded as one internal nested value. The caller places this into
 * `callbackURL=`; the server-side validator still checks the final target.
 */
export function buildAuthCallbackValue(location: BrowserLocation): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function buildAuthReturnHref(input: {
  authPrefix: string;
  mode: "signin" | "signup";
  location: BrowserLocation;
}): string {
  return `${input.authPrefix}/${input.mode}?callbackURL=${encodeURIComponent(buildAuthCallbackValue(input.location))}`;
}

/**
 * C9 click decision for a locale switch: only an unmodified primary-button
 * click may issue a continuation intent, and an intent write failure cancels
 * the locale navigation entirely so an active flow is never dropped onto the
 * other locale's landing surface.
 */
export type LocaleSwitchClickDecision =
  | { action: "ignore" }
  | { action: "cancel" }
  | { action: "navigate"; href: string };

export function prepareLocaleSwitchClick(input: {
  event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean };
  href: string;
  targetLocale: ContentLocale;
  liveFlow: { method: PublicReadingMethod; readingId: string; locale: ContentLocale; active: true } | null;
  issueIntent: (input: { method: PublicReadingMethod; readingId: string; targetLocale: ContentLocale }) => boolean;
}): LocaleSwitchClickDecision {
  const { event } = input;
  const plainLeftClick = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  // Modifier / middle-button activation opens another browsing context and
  // must never issue a continuation intent.
  if (!plainLeftClick) return { action: "ignore" };
  if (input.liveFlow?.active) {
    const issued = input.issueIntent({
      method: input.liveFlow.method,
      readingId: input.liveFlow.readingId,
      targetLocale: input.targetLocale,
    });
    if (!issued) return { action: "cancel" };
  }
  return { action: "navigate", href: input.href };
}

/**
 * Hydration-synced browser location. `useSearchParams` is deliberately not
 * used: the full browser location is read from `window.location` at hydration
 * and re-read at click time, so static rendering and hydration stay intact.
 * The SSR render uses a pathname-only safe fallback.
 */
export function useBrowserLocationSnapshot(): BrowserLocation {
  const pathname = usePathname() ?? "/";
  const [snapshot, setSnapshot] = useState<BrowserLocation>({ pathname, search: "", hash: "" });
  useEffect(() => {
    setSnapshot({
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    });
  }, [pathname]);
  return snapshot;
}

/**
 * The shared locale-switch affordance used by every locale switcher. One
 * implementation, one authority: both SceneNavigation and InfoPageHeader
 * consume this hook, so the outer/nested context rules and the C9 issue /
 * cancel rules cannot diverge between surfaces.
 */
export function useLocaleSwitch(targetLocale: ContentLocale): {
  href: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
} {
  const router = useRouter();
  const snapshot = useBrowserLocationSnapshot();
  const href = buildLocaleSwitchHref({ ...snapshot, targetLocale });

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const freshHref = buildLocaleSwitchHref({
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      targetLocale,
    });
    const decision = prepareLocaleSwitchClick({
      event,
      href: freshHref,
      targetLocale,
      liveFlow: getLiveFlowRegistration(),
      issueIntent: issueLocaleContinuationIntent,
    });
    if (decision.action === "ignore") return;
    event.preventDefault();
    if (decision.action === "cancel") return;
    router.push(decision.href);
  };

  return { href, onClick };
}

/**
 * Shared auth-return affordance: the Sign In / Sign Up hrefs always carry the
 * full originating context (pathname + search + hash), rebuilt from
 * `window.location` at click time so the return never drops the query or hash.
 * The locale prefix is supplied by the caller's own locale authority.
 */
export function useAuthReturnHrefs(authPrefix: string): {
  signinHref: string;
  signupHref: string;
  onClickSignin: (event: MouseEvent<HTMLAnchorElement>) => void;
  onClickSignup: (event: MouseEvent<HTMLAnchorElement>) => void;
} {
  const router = useRouter();
  const snapshot = useBrowserLocationSnapshot();
  const signinHref = buildAuthReturnHref({ authPrefix, mode: "signin", location: snapshot });
  const signupHref = buildAuthReturnHref({ authPrefix, mode: "signup", location: snapshot });

  const navigateFresh = (event: MouseEvent<HTMLAnchorElement>, mode: "signin" | "signup") => {
    const plainLeftClick = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (!plainLeftClick) return;
    event.preventDefault();
    router.push(buildAuthReturnHref({
      authPrefix,
      mode,
      location: {
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      },
    }));
  };

  return {
    signinHref,
    signupHref,
    onClickSignin: (event) => navigateFresh(event, "signin"),
    onClickSignup: (event) => navigateFresh(event, "signup"),
  };
}
