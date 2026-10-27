"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnalyticsConsent } from "@/components/analytics-consent";
import {
  analyticsProvidersAllowed,
  readStoredAnalyticsConsent,
  type AnalyticsConsentState,
} from "@/lib/analytics";

const SCRIPT_IDS = ["google-analytics-loader", "microsoft-clarity-loader"] as const;
const ANALYTICS_COOKIE_PREFIXES = ["_ga", "_clck", "_clsk"] as const;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[][] };
  }
}

function loadScript(id: string, src: string): void {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.append(script);
}

function startGa4(measurementId: string): void {
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted",
  });
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  loadScript(
    "google-analytics-loader",
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`,
  );
}

function startClarity(projectId: string): void {
  const clarity = ((...args: unknown[]) => {
    clarity.q = clarity.q ?? [];
    clarity.q.push(args);
  }) as NonNullable<Window["clarity"]>;

  window.clarity = window.clarity ?? clarity;
  window.clarity("consentv2", {
    ad_Storage: "denied",
    analytics_Storage: "granted",
  });
  loadScript(
    "microsoft-clarity-loader",
    `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`,
  );
}

function expireCookie(name: string, domain?: string): void {
  const domainPart = domain ? `; Domain=${domain}` : "";
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domainPart}`;
}

function clearAnalyticsCookies(): void {
  const hostname = window.location.hostname;
  const registrableHost = hostname.replace(/^www\./u, "");

  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=", 1)[0]?.trim();
    if (!name || !ANALYTICS_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix))) continue;
    expireCookie(name);
    expireCookie(name, hostname);
    if (registrableHost !== hostname) expireCookie(name, `.${registrableHost}`);
  }
}

function stopAnalytics(): void {
  window.gtag?.("consent", "update", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  window.clarity?.("consentv2", {
    ad_Storage: "denied",
    analytics_Storage: "denied",
  });

  for (const scriptId of SCRIPT_IDS) {
    document.getElementById(scriptId)?.remove();
  }
  clearAnalyticsCookies();
  window.dataLayer = [];
  delete window.gtag;
  delete window.clarity;
}

export function ConsentGatedAnalytics({
  gaMeasurementId,
  clarityProjectId,
}: {
  gaMeasurementId: string | null;
  clarityProjectId: string | null;
}) {
  const pathname = usePathname() ?? "/";
  const [consent, setConsent] = useState<AnalyticsConsentState | null>(null);

  useEffect(() => {
    setConsent(readStoredAnalyticsConsent());
  }, []);

  const enabled = analyticsProvidersAllowed(consent);

  useEffect(() => {
    if (!enabled) {
      stopAnalytics();
      return;
    }

    if (gaMeasurementId) {
      startGa4(gaMeasurementId);
      window.gtag?.("event", "page_view", {
        send_to: gaMeasurementId,
        page_location: window.location.href,
        page_path: pathname,
        page_title: document.title,
      });
    }
    if (clarityProjectId) startClarity(clarityProjectId);

    return stopAnalytics;
  }, [clarityProjectId, enabled, gaMeasurementId, pathname]);

  return <AnalyticsConsent onConsentChange={setConsent} />;
}
