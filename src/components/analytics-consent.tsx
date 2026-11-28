"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ANALYTICS_CONSENT_OPEN_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  readStoredAnalyticsConsent,
  type AnalyticsConsentState,
} from "@/lib/analytics";
import styles from "./analytics-consent.module.css";

const RESERVE_VAR = "--qic-consent-reserve";

export function AnalyticsConsent({ onConsentChange }: { onConsentChange?: (consent: AnalyticsConsentState) => void }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const stored = readStoredAnalyticsConsent();
    if (stored === null) {
      setVisible(true);
    }

    const reopen = () => setVisible(true);
    window.addEventListener(ANALYTICS_CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(ANALYTICS_CONSENT_OPEN_EVENT, reopen);
  }, []);

  // The panel floats over the bottom of the page. Publishing its real height lets
  // the reading surfaces reserve matching space after their last control, so the
  // form stays fully reachable instead of any heading being collapsed away.
  useEffect(() => {
    const root = document.documentElement;
    const node = panelRef.current;
    if (!visible || !node) {
      root.style.removeProperty(RESERVE_VAR);
      return;
    }
    const sync = () => {
      root.style.setProperty(RESERVE_VAR, `${Math.ceil(node.getBoundingClientRect().height + 16)}px`);
    };
    sync();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
    observer?.observe(node);
    return () => {
      observer?.disconnect();
      root.style.removeProperty(RESERVE_VAR);
    };
  }, [visible]);

  if (!mounted || !visible) {
    return null;
  }

  const isChinese = pathname?.startsWith("/zh");
  const kicker = isChinese ? "分析与隐私" : "Analytics & privacy";
  const message = isChinese
    ? "Quick I Ching 希望使用 Google Analytics 和 Microsoft Clarity 帮助了解网站使用情况。只有在你允许后才会启用分析存储。"
    : "Quick I Ching would like to use Google Analytics and Microsoft Clarity to understand site usage. Analytics storage is enabled only if you allow it.";
  const declineLabel = isChinese ? "拒绝" : "Decline";
  const allowLabel = isChinese ? "允许分析" : "Allow analytics";

  const handleDecline = () => {
    try {
      window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "denied");
    } catch {
      // Ignore private browsing storage error
    }
    setVisible(false);
    onConsentChange?.("denied");
  };

  const handleAllow = () => {
    try {
      window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    } catch {
      // Ignore private browsing storage error
    }
    setVisible(false);
    onConsentChange?.("granted");
  };

  return (
    <div
      ref={panelRef}
      role="region"
      aria-label={isChinese ? "分析工具同意设置" : "Analytics Consent"}
      className={styles.panel}
    >
      <div className={styles.copy}>
        <p className={styles.kicker}>{kicker}</p>
        <p className={styles.message}>{message}</p>
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={handleDecline} className={styles.decline}>
          {declineLabel}
        </button>
        <button type="button" onClick={handleAllow} className={styles.allow}>
          {allowLabel}
        </button>
      </div>
    </div>
  );
}
