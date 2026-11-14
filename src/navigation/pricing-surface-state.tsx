"use client";

import { useDeclarePricingReadingContext } from "./navigation-surface-context";

/**
 * Lets /pricing declare whether it holds a validated reading return context.
 * The shell then resolves S15 (Direct Pricing) or S16 (Pricing reading return)
 * from that flow state instead of guessing from a query string.
 */
export function PricingSurfaceState({ readingContext }: { readingContext: boolean }) {
  useDeclarePricingReadingContext(readingContext);
  return null;
}
