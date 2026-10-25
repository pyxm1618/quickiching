import { ConsentGatedAnalytics } from "@/components/consent-gated-analytics";
import { getAnalyticsConfig } from "@/lib/analytics";

export function SiteAnalytics() {
  const { gaMeasurementId, clarityProjectId } = getAnalyticsConfig();
  return (
    <ConsentGatedAnalytics
      gaMeasurementId={gaMeasurementId}
      clarityProjectId={clarityProjectId}
    />
  );
}
