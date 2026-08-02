export const ANALYTICS_CONSENT_COOKIE = "qic_analytics_consent";
export const OPEN_ANALYTICS_SETTINGS_EVENT = "qic:open-cookie-settings";

export type StoredAnalyticsConsent = "granted" | "denied";
export type AnalyticsConsent = StoredAnalyticsConsent | "unset";

const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const COOKIE_EXPIRY_IN_THE_PAST = "Thu, 01 Jan 1970 00:00:00 GMT";

function parseCookiePairs(cookieHeader: string): Array<[string, string]> {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex < 0) return [part, ""] as [string, string];
      return [part.slice(0, separatorIndex), part.slice(separatorIndex + 1)] as [string, string];
    });
}

export function parseAnalyticsConsent(cookieHeader: string): AnalyticsConsent {
  const value = parseCookiePairs(cookieHeader).find(
    ([name]) => name === ANALYTICS_CONSENT_COOKIE,
  )?.[1];

  return value === "granted" || value === "denied" ? value : "unset";
}

export function serializeAnalyticsConsent(
  consent: StoredAnalyticsConsent,
  secure: boolean,
): string {
  return [
    `${ANALYTICS_CONSENT_COOKIE}=${consent}`,
    `Max-Age=${CONSENT_MAX_AGE_SECONDS}`,
    "Path=/",
    "SameSite=Lax",
    secure ? "Secure" : null,
  ]
    .filter((part): part is string => part !== null)
    .join("; ");
}

export function isValidGaMeasurementId(value: string | undefined): value is string {
  return typeof value === "string" && /^G-[A-Z0-9]+$/.test(value);
}

export function findGoogleAnalyticsCookieNames(cookieHeader: string): string[] {
  const names = parseCookiePairs(cookieHeader)
    .map(([name]) => name)
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));

  return [...new Set(names)];
}

function cookieDomainCandidates(hostname: string): string[] {
  const normalizedHostname = hostname.trim().toLowerCase().replace(/^\.+/, "");
  const candidates = new Set<string>([""]);

  if (!normalizedHostname) return [...candidates];

  candidates.add(normalizedHostname);
  candidates.add(`.${normalizedHostname}`);

  const labels = normalizedHostname.split(".");
  if (labels.length > 2) {
    const rootDomain = labels.slice(-2).join(".");
    candidates.add(rootDomain);
    candidates.add(`.${rootDomain}`);
  }

  return [...candidates];
}

export function buildGoogleAnalyticsCookieDeletionStrings(
  cookieHeader: string,
  hostname: string,
  secure: boolean,
): string[] {
  const names = findGoogleAnalyticsCookieNames(cookieHeader);
  const domains = cookieDomainCandidates(hostname);

  return names.flatMap((name) =>
    domains.map((domain) =>
      [
        `${name}=`,
        "Max-Age=0",
        `Expires=${COOKIE_EXPIRY_IN_THE_PAST}`,
        "Path=/",
        "SameSite=Lax",
        domain ? `Domain=${domain}` : null,
        secure ? "Secure" : null,
      ]
        .filter((part): part is string => part !== null)
        .join("; "),
    ),
  );
}
