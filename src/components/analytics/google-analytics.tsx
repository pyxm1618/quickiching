"use client";

import Script from "next/script";
import { isValidGaMeasurementId } from "@/lib/analytics-consent";

const DEFAULT_CONSENT = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const;

const GRANTED_ANALYTICS_CONSENT = {
  analytics_storage: "granted",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const;

export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  if (!isValidGaMeasurementId(measurementId)) return null;

  const bootstrap = `
window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
window.gtag("consent", "default", ${JSON.stringify(DEFAULT_CONSENT)});
window.gtag("consent", "update", ${JSON.stringify(GRANTED_ANALYTICS_CONSENT)});
window.gtag("set", "ads_data_redaction", true);
window.gtag("js", new Date());
window.gtag("config", ${JSON.stringify(measurementId)}, {
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
  cookie_expires: 15552000,
  send_page_view: true
});
`;

  return (
    <>
      <Script id="qic-ga-bootstrap" strategy="afterInteractive">
        {bootstrap}
      </Script>
      <Script
        id="qic-ga-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
      />
    </>
  );
}
