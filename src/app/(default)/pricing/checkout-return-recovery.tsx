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
  const [timedOut, setTimedOut] = useState(false);

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
    if (Date.now() - startedAtRef.current >= AUTO_REFRESH_WINDOW_MS) {
      setTimedOut(true);
      return;
    }

    const timer = window.setTimeout(() => {
      router.refresh();
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [credits, router]);

  if (!waiting) return null;

  if (timedOut) {
    return (
      <p className="mt-6 text-center text-sm leading-6 text-[var(--ink-2)]" role="status">
        Credit confirmation is taking longer than expected.{" "}
        <button
          type="button"
          className="underline"
          onClick={() => router.refresh()}
        >
          Check again
        </button>
        , or return to your reading from{" "}
        <a href="/account" className="underline">account history</a>.
      </p>
    );
  }

  return (
    <p className="mt-6 text-center text-sm leading-6 text-[var(--ink-2)]" role="status">
      Payment confirmation is being checked from your account. This page will return to your reading after the credit is posted.
    </p>
  );
}
