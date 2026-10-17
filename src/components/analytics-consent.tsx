"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  readStoredAnalyticsConsent,
} from "@/lib/analytics";

export function AnalyticsConsent() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = readStoredAnalyticsConsent();
    if (stored === null) {
      setVisible(true);
    }
  }, []);

  if (!mounted || !visible) {
    return null;
  }

  const isChinese = pathname?.startsWith("/zh");
  const message = isChinese
    ? "我们使用 Google Analytics 了解网站使用情况。"
    : "We use Google Analytics to understand site usage.";
  const declineLabel = isChinese ? "拒绝" : "Decline";
  const allowLabel = isChinese ? "允许分析" : "Allow analytics";

  const handleDecline = () => {
    try {
      window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "denied");
    } catch {
      // Ignore private browsing storage error
    }
    setVisible(false);
  };

  const handleAllow = () => {
    window.gtag?.("consent", "update", {
      analytics_storage: "granted",
    });
    try {
      window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    } catch {
      // Ignore private browsing storage error
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Analytics Consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--line)] bg-[var(--paper-raised)] px-4 py-3 backdrop-blur-md shadow-lg"
    >
      <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-xs text-[var(--ink-2)] sm:text-sm">{message}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDecline}
            className="inline-flex min-h-9 items-center justify-center rounded border border-[var(--line)] px-3 text-xs font-medium text-[var(--ink-3)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cinnabar)]"
          >
            {declineLabel}
          </button>
          <button
            type="button"
            onClick={handleAllow}
            className="inline-flex min-h-9 items-center justify-center rounded bg-[var(--gold)] px-3 text-xs font-medium text-[#17110d] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cinnabar)]"
          >
            {allowLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
