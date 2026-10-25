"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { readStoredAnalyticsConsent } from "@/lib/analytics";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function GoogleAnalyticsPageView({
  measurementId,
}: {
  measurementId: string;
}) {
  const pathname = usePathname();

  useEffect(() => {
    const consent = readStoredAnalyticsConsent();
    if (consent !== "granted") return;
    window.gtag?.("consent", "update", {
      analytics_storage: "granted",
    });

    window.gtag?.("event", "page_view", {
      send_to: measurementId,
      page_location: window.location.href,
      page_path: pathname,
      page_title: document.title,
    });
  }, [measurementId, pathname]);

  return null;
}
