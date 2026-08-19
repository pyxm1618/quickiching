import {
  localeDefinition,
  type ContentLocale,
  SITE_ORIGIN,
} from "./config";
import { indexablePathInventory, localizedRoute, routeForPath } from "./routes";

function normalizePath(path: string): string {
  if (!path.startsWith("/")) return normalizePath(`/${path}`);
  if (path === "/") return "/";
  return path.replace(/\/+$/, "") || "/";
}

export function publicPath(locale: ContentLocale, pathnameWithoutLocale: string): string {
  const normalized = normalizePath(pathnameWithoutLocale);
  if (locale === "en") return normalized;
  return normalized === "/" ? "/zh" : `/zh${normalized}`;
}

export function canonicalUrl(path: string): string {
  return new URL(normalizePath(path), `${SITE_ORIGIN}/`).toString();
}

export function alternateLanguages(routeId: string): Record<string, string> | undefined {
  const route = localizedRoute(routeId);
  const englishPath = route.paths.en;
  const chinesePath = route.paths["zh-Hans"];
  if (!route.hreflangGroup || !englishPath || !chinesePath || !route.renderable.en || !route.renderable["zh-Hans"]) return undefined;
  return {
    en: canonicalUrl(englishPath),
    "zh-Hans": canonicalUrl(chinesePath),
    "x-default": canonicalUrl(englishPath),
  };
}

export function languageSwitchTarget(routeId: string, locale: ContentLocale): { href: string; label: string; equivalent: boolean } {
  const route = localizedRoute(routeId);
  const targetLocale: ContentLocale = locale === "en" ? "zh-Hans" : "en";
  const targetPath = route.paths[targetLocale];
  if (targetPath && route.renderable[targetLocale]) {
    return { href: targetPath, label: targetLocale === "zh-Hans" ? "简体中文" : "English", equivalent: true };
  }
  return locale === "en"
    ? { href: "/zh", label: "中文首页", equivalent: false }
    : { href: "/", label: "English", equivalent: false };
}

export function sitemapUrlInventory(): readonly string[] {
  return indexablePathInventory().map((path) => canonicalUrl(path));
}

export function currentRouteForPath(path: string) {
  return routeForPath(normalizePath(path));
}

export function localePathSegment(locale: ContentLocale): string {
  return localeDefinition(locale).publicSegment;
}

export { indexablePathInventory, normalizePath };
