"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { Button } from "@/components/ui/button";
import {
  buildGoogleAnalyticsCookieDeletionStrings,
  isValidGaMeasurementId,
  OPEN_ANALYTICS_SETTINGS_EVENT,
  parseAnalyticsConsent,
  serializeAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/analytics-consent";

type ConsentState = AnalyticsConsent | "loading";

const DENIED_CONSENT_UPDATE = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const;

export function AnalyticsConsentController() {
  const measurementId = useMemo(() => {
    const configured = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    return process.env.NODE_ENV === "production" && isValidGaMeasurementId(configured)
      ? configured
      : null;
  }, []);

  const [consent, setConsent] = useState<ConsentState>("loading");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!measurementId) return;

    const storedConsent = parseAnalyticsConsent(document.cookie);
    setConsent(storedConsent);
    setIsOpen(storedConsent === "unset");

    const openSettings = () => setIsOpen(true);
    window.addEventListener(OPEN_ANALYTICS_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_ANALYTICS_SETTINGS_EVENT, openSettings);
  }, [measurementId]);

  const persistConsent = useCallback((nextConsent: "granted" | "denied") => {
    const secure = window.location.protocol === "https:";
    document.cookie = serializeAnalyticsConsent(nextConsent, secure);
    setConsent(nextConsent);
    setIsOpen(false);
  }, []);

  const acceptAnalytics = useCallback(() => {
    persistConsent("granted");
  }, [persistConsent]);

  const rejectAnalytics = useCallback(() => {
    const wasGranted = consent === "granted";
    const secure = window.location.protocol === "https:";

    if (wasGranted) {
      window.gtag?.("consent", "update", DENIED_CONSENT_UPDATE);
      (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = true;
    }

    for (const deletion of buildGoogleAnalyticsCookieDeletionStrings(
      document.cookie,
      window.location.hostname,
      secure,
    )) {
      document.cookie = deletion;
    }

    persistConsent("denied");

    if (wasGranted) {
      window.setTimeout(() => window.location.reload(), 0);
    }
  }, [consent, measurementId, persistConsent]);

  if (!measurementId || consent === "loading") return null;

  return (
    <>
      {consent === "granted" ? <GoogleAnalytics measurementId={measurementId} /> : null}

      {isOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-4 sm:px-6 sm:pb-6">
          <section
            aria-labelledby="analytics-consent-title"
            aria-modal="false"
            role="dialog"
            className="mx-auto flex max-w-4xl flex-col gap-5 rounded-xl border border-[var(--line-strong)] bg-[var(--paper-raised)] p-5 shadow-2xl sm:flex-row sm:items-end sm:justify-between sm:p-6"
          >
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">
                Optional analytics
              </p>
              <h2 id="analytics-consent-title" className="mt-2 text-xl font-semibold tracking-tight">
                Choose whether to share usage analytics
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Google Analytics loads only after you accept. We measure page and feature usage, but
                never send your question text, email, reading content, authentication secrets, or
                payment details.
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Rejecting analytics does not affect casting, sign-in, purchases, or saved readings. See
                the{" "}
                <Link className="underline underline-offset-4" href="/privacy">
                  Privacy Policy
                </Link>
                .
              </p>
              {consent !== "unset" ? (
                <p className="mt-2 text-xs text-[var(--ink-3)]">
                  Current choice: {consent === "granted" ? "analytics accepted" : "analytics rejected"}.
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              {consent !== "unset" ? (
                <Button variant="ghost" onClick={() => setIsOpen(false)}>
                  Close
                </Button>
              ) : null}
              <Button variant="outline" onClick={rejectAnalytics}>
                Reject analytics
              </Button>
              <Button onClick={acceptAnalytics}>Accept analytics</Button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
