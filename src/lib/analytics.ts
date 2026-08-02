export type AnalyticsParameterValue = string | number | boolean;
export type AnalyticsEventParameters = Record<string, unknown>;

const SAFE_ANALYTICS_PARAMETER_KEYS = new Set([
  "method",
  "scene",
  "goal",
  "status",
  "step",
  "plan",
  "source",
  "reason_code",
  "duration_bucket",
  "currency",
  "value",
  "quantity",
  "has_changing_lines",
  "is_authenticated",
]);

const ANALYTICS_EVENT_NAME = /^[a-z][a-z0-9_]{0,39}$/;
const MACHINE_TOKEN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const CURRENCY_CODE = /^[A-Z]{3}$/;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function isValidAnalyticsEventName(name: string): boolean {
  return ANALYTICS_EVENT_NAME.test(name);
}

export function sanitizeAnalyticsEventParams(
  params: AnalyticsEventParameters,
): Record<string, AnalyticsParameterValue> {
  const sanitized: Record<string, AnalyticsParameterValue> = {};

  for (const [key, value] of Object.entries(params)) {
    if (!SAFE_ANALYTICS_PARAMETER_KEYS.has(key)) continue;

    if (typeof value === "boolean") {
      sanitized[key] = value;
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      sanitized[key] = value;
      continue;
    }

    if (typeof value !== "string") continue;

    if (key === "currency") {
      if (CURRENCY_CODE.test(value)) sanitized[key] = value;
      continue;
    }

    if (MACHINE_TOKEN.test(value)) sanitized[key] = value;
  }

  return sanitized;
}

export function trackAnalyticsEvent(
  name: string,
  params: AnalyticsEventParameters = {},
): boolean {
  if (!isValidAnalyticsEventName(name)) return false;
  if (typeof window === "undefined" || typeof window.gtag !== "function") return false;

  window.gtag("event", name, sanitizeAnalyticsEventParams(params));
  return true;
}
