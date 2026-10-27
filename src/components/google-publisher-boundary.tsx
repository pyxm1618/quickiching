"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { openPrivacySettings } from "@/components/consent-adapter";
import {
  GOOGLE_PUBLISHER_CLIENT,
  GOOGLE_PUBLISHER_SCRIPT_ID,
  isGooglePublisherSurface,
} from "@/lib/privacy-route-policy";

export function GooglePublisherBoundary() {
  const pathname = usePathname() ?? "/";
  const enabled = isGooglePublisherSurface(pathname);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("privacy-settings") !== "1") return;

    let attempts = 0;
    const tryOpen = () => {
      attempts += 1;
      if (!openPrivacySettings() && attempts < 25) return;

      if (attempts < 25) {
        url.searchParams.delete("privacy-settings");
        const replacement = url.pathname + (url.search ? url.search : "") + url.hash;
        window.history.replaceState(window.history.state, "", replacement);
      }
      window.clearInterval(intervalId);
    };

    const intervalId = window.setInterval(tryOpen, 200);
    tryOpen();
    return () => window.clearInterval(intervalId);
  }, [enabled, pathname]);

  if (!enabled) return null;

  return (
    <Script
      id={GOOGLE_PUBLISHER_SCRIPT_ID}
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${GOOGLE_PUBLISHER_CLIENT}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
