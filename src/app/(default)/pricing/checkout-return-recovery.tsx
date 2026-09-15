"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearCheckoutReturnContext,
  readCheckoutReturnContext,
} from "./checkout-return-context";

const AUTO_REFRESH_WINDOW_MS = 30_000;
const AUTO_REFRESH_INTERVAL_MS = 1_500;

export function CheckoutReturnRecovery({ credits }: { credits: number }) {
  const router = useRouter();
  const startedAtRef = useRef(Date.now());
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    const context = readCheckoutReturnContext(window.sessionStorage);
    if (!context) {
      setWaiting(false);
      return;
    }

    if (credits > context.creditsBeforeCheckout) {
      clearCheckoutReturnContext(window.sessionStorage);
      window.location.assign(context.returnUrl);
      return;
    }

    setWaiting(true);
    if (Date.now() - startedAtRef.current >= AUTO_REFRESH_WINDOW_MS) return;

    const timer = window.setTimeout(() => {
      router.refresh();
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [credits, router]);

  if (!waiting) return null;

  return (
    <p className="mt-6 text-center text-sm leading-6 text-[var(--ink-2)]" role="status">
      Payment confirmation is being checked from your account. This page will return to your reading after the credit is posted.
    </p>
  );
}
