"use client";

import type { ReactNode } from "react";
import {
  isValidGaMeasurementId,
  OPEN_ANALYTICS_SETTINGS_EVENT,
} from "@/lib/analytics-consent";
import { cn } from "@/lib/utils";

export function CookieSettingsButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const configured = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const enabled = process.env.NODE_ENV === "production" && isValidGaMeasurementId(configured);

  if (!enabled) return null;

  return (
    <button
      type="button"
      className={cn("text-left", className)}
      onClick={() => window.dispatchEvent(new Event(OPEN_ANALYTICS_SETTINGS_EVENT))}
    >
      {children}
    </button>
  );
}
