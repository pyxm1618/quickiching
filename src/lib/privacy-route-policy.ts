export const GOOGLE_PUBLISHER_CLIENT = "ca-pub-2804737462866511";
export const GOOGLE_PUBLISHER_SCRIPT_ID = "quickiching-google-publisher";

const PUBLIC_EXACT = new Set([
  "/",
  "/hexagrams",
  "/pricing",
  "/help",
  "/privacy",
]);

const PUBLIC_PREFIXES = [
  "/hexagrams/",
  "/guides/",
  "/methods/",
] as const;

const SENSITIVE_EXACT = new Set([
  "/account",
  "/history",
  "/signin",
  "/signup",
]);

const SENSITIVE_PREFIXES = [
  "/account/",
  "/history/",
  "/signin/",
  "/signup/",
  "/readings/",
  "/checkout/",
] as const;

function withoutLocalePrefix(pathname: string): string {
  if (pathname === "/zh") return "/";
  if (pathname.startsWith("/zh/")) return pathname.slice(3) || "/";
  return pathname || "/";
}

export function isSensitiveUserSurface(pathname: string): boolean {
  const normalized = withoutLocalePrefix(pathname);
  return (
    SENSITIVE_EXACT.has(normalized) ||
    SENSITIVE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

export function isGooglePublisherSurface(pathname: string): boolean {
  if (isSensitiveUserSurface(pathname)) return false;
  const normalized = withoutLocalePrefix(pathname);
  return (
    PUBLIC_EXACT.has(normalized) ||
    PUBLIC_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

export function isAnalyticsSurface(pathname: string): boolean {
  if (!isGooglePublisherSurface(pathname)) return false;
  const normalized = withoutLocalePrefix(pathname);
  return normalized !== "/privacy";
}
