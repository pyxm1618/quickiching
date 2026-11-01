"use client";

import React from "react";
import { ANALYTICS_CONSENT_OPEN_EVENT } from "@/lib/analytics";
import type { ContentLocale } from "@/i18n/config";

export function PrivacySettingsButton({
  locale = "en",
  label,
  className,
}: {
  locale?: ContentLocale;
  label?: string;
  className?: string;
}) {
  const isChinese = locale === "zh-Hans";

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_OPEN_EVENT))}
      className={className ?? "inline-flex min-h-11 items-center text-[var(--ink-3)] transition-colors hover:text-[var(--jade)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cinnabar)]"}
    >
      {label ?? (isChinese ? "隐私与网站数据设置" : "Privacy & cookie settings")}
    </button>
  );
}
