import Script from "next/script";
import { GoogleAnalyticsPageView } from "@/components/google-analytics-page-view";
import { getAnalyticsConfig } from "@/lib/analytics";

function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const bootstrap = `window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};window.gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});window.gtag('js',new Date());window.gtag('config','${measurementId}',{send_page_view:false});`;

  return (
    <>
      <script
        id="google-analytics-bootstrap"
        dangerouslySetInnerHTML={{ __html: bootstrap }}
      />
      <Script
        id="google-analytics-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <GoogleAnalyticsPageView measurementId={measurementId} />
    </>
  );
}

function MicrosoftClarity({ projectId }: { projectId: string }) {
  return (
    <Script id="microsoft-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments);};c[a]('consentv2',{ad_Storage:'denied',analytics_Storage:'denied'});t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,'clarity','script','${projectId}');`}
    </Script>
  );
}

export function SiteAnalytics() {
  const { gaMeasurementId, clarityProjectId } = getAnalyticsConfig();

  return (
    <>
      {gaMeasurementId ? <GoogleAnalytics measurementId={gaMeasurementId} /> : null}
      {clarityProjectId ? <MicrosoftClarity projectId={clarityProjectId} /> : null}
    </>
  );
}
