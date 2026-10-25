"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { AnalyticsConsent } from "@/components/analytics-consent";
import { GoogleAnalyticsPageView } from "@/components/google-analytics-page-view";
import {
  analyticsProvidersAllowed,
  readStoredAnalyticsConsent,
  type AnalyticsConsentState,
} from "@/lib/analytics";

export function ConsentGatedAnalytics({
  gaMeasurementId,
  clarityProjectId,
}: {
  gaMeasurementId: string | null;
  clarityProjectId: string | null;
}) {
  const [consent, setConsent] = useState<AnalyticsConsentState | null>(null);
  const [gaReady, setGaReady] = useState(false);

  useEffect(() => {
    setConsent(readStoredAnalyticsConsent());
  }, []);

  const enabled = analyticsProvidersAllowed(consent);
  const bootstrap = gaMeasurementId
    ? `window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};window.gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});window.gtag('js',new Date());window.gtag('config','${gaMeasurementId}',{send_page_view:false});`
    : "";

  return (
    <>
      {enabled && gaMeasurementId ? (
        <>
          <Script id="google-analytics-bootstrap" strategy="afterInteractive" onReady={() => setGaReady(true)}>
            {bootstrap}
          </Script>
          <Script
            id="google-analytics-loader"
            src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
            strategy="afterInteractive"
          />
          {gaReady ? <GoogleAnalyticsPageView measurementId={gaMeasurementId} /> : null}
        </>
      ) : null}
      {enabled && clarityProjectId ? (
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments);};c[a]('consentv2',{ad_Storage:'denied',analytics_Storage:'granted'});t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,'clarity','script','${clarityProjectId}');`}
        </Script>
      ) : null}
      <AnalyticsConsent onConsentChange={setConsent} />
    </>
  );
}
