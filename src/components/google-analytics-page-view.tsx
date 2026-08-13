"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

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
    window.gtag?.("event", "page_view", {
      send_to: measurementId,
      page_location: window.location.href,
      page_path: pathname,
      page_title: document.title,
    });
  }, [measurementId, pathname]);

  return null;
}
