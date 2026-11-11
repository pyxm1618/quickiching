"use client";

import React from "react";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PaymentReturnStatus, type VisiblePaymentReturnPhase } from "@/components/commercial/payment-return-status";
import {
  clearCheckoutReturnContext,
  readCheckoutReturnContext,
  type CheckoutReturnContext,
} from "./checkout-return-context";

export const CHECKOUT_CONFIRMATION_WINDOW_MS = 30_000;
const AUTO_REFRESH_INTERVAL_MS = 5_000;
type ReturnPhase = "inactive" | VisiblePaymentReturnPhase;

export function resolveCheckoutReturnPhase(input: {
  orderId?: string;
  context: CheckoutReturnContext | null;
  credits: number;
  elapsedMs?: number;
}): ReturnPhase {
  if (!input.orderId) return "inactive";
  if (input.context?.orderId === input.orderId && input.credits > input.context.creditsBeforeCheckout) return "confirmed";
  if ((input.elapsedMs ?? 0) >= CHECKOUT_CONFIRMATION_WINDOW_MS) return "delayed";
  return "checking";
}

export function CheckoutReturnRecovery({
  credits,
  orderId,
  locale = "en",
}: {
  credits: number;
  orderId?: string;
  locale?: "en" | "zh-Hans";
}) {
  const router = useRouter();
  const startedAtRef = useRef(Date.now());
  const [phase, setPhase] = useState<ReturnPhase>(orderId ? "checking" : "inactive");
  const [context, setContext] = useState<CheckoutReturnContext | null>(null);
  const [refreshPending, startRefreshTransition] = useTransition();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!orderId) {
      setPhase("inactive");
      setContext(null);
      return;
    }
    const stored = readCheckoutReturnContext(window.sessionStorage);
    const matched = stored?.orderId === orderId ? stored : null;
    setContext(matched);
    const nextPhase = resolveCheckoutReturnPhase({
      orderId,
      context: matched,
      credits,
      elapsedMs: Date.now() - startedAtRef.current,
    });
    setPhase(nextPhase);
    if (nextPhase !== "checking" || refreshPending) return;
    const timer = window.setTimeout(() => {
      startRefreshTransition(() => {
        router.refresh();
        setTick((value) => value + 1);
      });
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [credits, orderId, refreshPending, router, tick]);

  if (phase === "inactive") return null;

  const returnToReading = () => {
    if (!context?.returnUrl) return;
    clearCheckoutReturnContext(window.sessionStorage);
    window.location.assign(context.returnUrl);
  };
  const clearAndStayOnPricing = () => clearCheckoutReturnContext(window.sessionStorage);
  const checkAgain = () => {
    startedAtRef.current = Date.now();
    setPhase("checking");
    startRefreshTransition(() => {
      router.refresh();
      setTick((value) => value + 1);
    });
  };

  return <PaymentReturnStatus
    phase={phase}
    credits={credits}
    locale={locale}
    hasReadingReturn={Boolean(context?.returnUrl)}
    refreshPending={refreshPending}
    onCheckAgain={checkAgain}
    onReturnToReading={returnToReading}
    onFinishPricing={clearAndStayOnPricing}
  />;
}
