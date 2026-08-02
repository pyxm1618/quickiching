"use client";

import Script from "next/script";
import { isValidClarityProjectId } from "@/lib/analytics-consent";

declare global {
  interface Window {
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[][] };
  }
}

export function MicrosoftClarity({ projectId }: { projectId: string }) {
  if (!isValidClarityProjectId(projectId)) return null;

  const bootstrap = `
window.clarity = window.clarity || function(){
  (window.clarity.q = window.clarity.q || []).push(arguments);
};
window.clarity("consentv2", {
  ad_Storage: "denied",
  analytics_Storage: "granted"
});
`;

  return (
    <>
      <Script id="qic-clarity-bootstrap" strategy="afterInteractive">
        {bootstrap}
      </Script>
      <Script
        id="qic-clarity-loader"
        src={`https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`}
        strategy="afterInteractive"
      />
    </>
  );
}
