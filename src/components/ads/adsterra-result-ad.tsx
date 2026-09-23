"use client";

import React, { useEffect, useState } from "react";
import Script from "next/script";
import { ADSTERRA_RESULT_UNIT, isAdsterraEnabled, isAdsterraRuntimeHost } from "@/lib/adsterra";

const BUILD_ENABLED = isAdsterraEnabled();

export function AdsterraResultAd({
  locale = "en",
}: {
  locale?: "en" | "zh-Hans";
} = {}) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!BUILD_ENABLED) return;
    setEnabled(isAdsterraRuntimeHost(window.location.hostname));
  }, []);

  if (!enabled) return null;

  const isChinese = locale === "zh-Hans";
  const label = isChinese ? "广告" : "Advertisement";

  return (
    <aside
      aria-label={label}
      data-adsterra-result-slot="true"
      className="mt-8 min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-black/10 px-3 py-4 sm:px-5"
    >
      <p className="mb-3 text-center font-mono text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-3)]">
        {label}
      </p>
      <Script
        id={ADSTERRA_RESULT_UNIT.scriptElementId}
        src={ADSTERRA_RESULT_UNIT.scriptUrl}
        strategy="lazyOnload"
        async
        data-cfasync="false"
      />
      <div
        id={ADSTERRA_RESULT_UNIT.containerId}
        className="mx-auto min-h-[250px] w-full max-w-[970px] overflow-hidden"
      />
    </aside>
  );
}
