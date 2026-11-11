"use client";

import { CheckCircle2, Clock3, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import styles from "@/components/commercial/commercial-ui.module.css";
import {
  clearCheckoutReturnContext,
  readCheckoutReturnContext,
  type CheckoutReturnContext,
} from "./checkout-return-context";

const AUTO_REFRESH_WINDOW_MS = 30_000;
const AUTO_REFRESH_INTERVAL_MS = 5_000;

type ReturnPhase = "inactive" | "checking" | "confirmed" | "delayed";

export function resolveCheckoutReturnPhase(input: {
  orderId?: string;
  context: CheckoutReturnContext | null;
  credits: number;
}): "inactive" | "checking" | "confirmed" {
  if (!input.orderId) return "inactive";
  if (!input.context || input.context.orderId !== input.orderId) return "checking";
  return input.credits > input.context.creditsBeforeCheckout ? "confirmed" : "checking";
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
  const copy = getDictionary(locale).commercial;
  const zh = locale === "zh-Hans";
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

    if (resolveCheckoutReturnPhase({ orderId, context: matched, credits }) === "confirmed") {
      setPhase("confirmed");
      return;
    }

    if (refreshPending) return;
    if (Date.now() - startedAtRef.current >= AUTO_REFRESH_WINDOW_MS) {
      setPhase("delayed");
      return;
    }

    setPhase("checking");
    const timer = window.setTimeout(() => {
      startRefreshTransition(() => {
        router.refresh();
        setTick((value) => value + 1);
      });
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [credits, orderId, refreshPending, router, tick]);

  if (phase === "inactive") return null;

  const accountHref = zh ? "/zh/account" : "/account";
  const pricingHref = zh ? "/zh/pricing" : "/pricing";
  const returnToReading = () => {
    if (!context?.returnUrl) return;
    clearCheckoutReturnContext(window.sessionStorage);
    window.location.assign(context.returnUrl);
  };
  const clearAndStayOnPricing = () => {
    clearCheckoutReturnContext(window.sessionStorage);
  };

  return (
    <section
      className={styles.paymentCard}
      data-payment-return-state={phase}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={styles.paymentIcon} aria-hidden="true">
        {phase === "checking" ? <LoaderCircle className={styles.spinner} /> : phase === "confirmed" ? <CheckCircle2 /> : <Clock3 />}
      </div>

      {phase === "checking" ? (
        <>
          <p className={styles.statusKicker}>{copy.paymentCheckingKicker}</p>
          <h2 className={styles.statusTitle}>{copy.paymentCheckingTitle}</h2>
          <p className={styles.statusText}>{copy.paymentCheckingDescription}</p>
          <p className={styles.statusSafety}>{copy.paymentDoNotRepurchase}</p>
        </>
      ) : phase === "confirmed" ? (
        <>
          <p className={styles.statusKicker}>{copy.paymentConfirmedKicker}</p>
          <h2 className={styles.statusTitle}>{copy.paymentConfirmedTitle}</h2>
          <p className={styles.statusText}>{copy.paymentConfirmedDescription}</p>
          <div className={styles.confirmedBalance}>{copy.currentBalance}: {credits} {credits === 1 ? copy.creditSingular : copy.creditPlural}</div>
          {!context?.returnUrl ? <p className={styles.statusSafety}>{copy.directConfirmedNote}</p> : null}
          <div className={styles.actions}>
            {context?.returnUrl ? (
              <button type="button" className={styles.primaryAction} onClick={returnToReading}>{copy.returnReading}</button>
            ) : (
              <a href={pricingHref} className={styles.primaryAction} onClick={clearAndStayOnPricing}>{copy.backToPacks}</a>
            )}
            <a href={accountHref} className={styles.secondaryAction}>{copy.viewAccount}</a>
          </div>
        </>
      ) : (
        <>
          <p className={styles.statusKicker}>{copy.paymentDelayedKicker}</p>
          <h2 className={styles.statusTitle}>{copy.paymentDelayedTitle}</h2>
          <p className={styles.statusText}>{copy.paymentDelayedDescription}</p>
          <p className={styles.statusSafety}>{copy.paymentDoNotRepurchase}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryAction}
              disabled={refreshPending}
              onClick={() => {
                startedAtRef.current = Date.now();
                setPhase("checking");
                startRefreshTransition(() => {
                  router.refresh();
                  setTick((value) => value + 1);
                });
              }}
            >
              {copy.checkAgain}
            </button>
            <a href={accountHref} className={styles.secondaryAction}>{copy.viewAccount}</a>
          </div>
        </>
      )}
    </section>
  );
}
