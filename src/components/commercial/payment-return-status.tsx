"use client";

import { CheckCircle2, Clock3, LoaderCircle } from "lucide-react";
import { getDictionary } from "@/i18n/dictionaries";
import styles from "./commercial-ui.module.css";

type Locale = "en" | "zh-Hans";
export type VisiblePaymentReturnPhase = "checking" | "confirmed" | "delayed";

export function PaymentReturnStatus({
  phase,
  credits,
  locale,
  hasReadingReturn,
  refreshPending = false,
  onCheckAgain,
  onReturnToReading,
  onFinishPricing,
}: {
  phase: VisiblePaymentReturnPhase;
  credits: number;
  locale: Locale;
  hasReadingReturn: boolean;
  refreshPending?: boolean;
  onCheckAgain?: () => void;
  onReturnToReading?: () => void;
  onFinishPricing?: () => void;
}) {
  const copy = getDictionary(locale).commercial;
  const accountHref = locale === "zh-Hans" ? "/zh/account" : "/account";
  const pricingHref = locale === "zh-Hans" ? "/zh/pricing" : "/pricing";

  return (
    <section className={styles.paymentCard} data-payment-return-state={phase}>
      <div role="status" aria-live="polite" aria-atomic="true" aria-busy={phase === "checking"}>
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
            <div className={styles.confirmedBalance}>
              {copy.currentBalance}: {credits} {credits === 1 ? copy.creditSingular : copy.creditPlural}
            </div>
            {!hasReadingReturn ? <p className={styles.statusSafety}>{copy.directConfirmedNote}</p> : null}
          </>
        ) : (
          <>
            <p className={styles.statusKicker}>{copy.paymentDelayedKicker}</p>
            <h2 className={styles.statusTitle}>{copy.paymentDelayedTitle}</h2>
            <p className={styles.statusText}>{copy.paymentDelayedDescription}</p>
            <p className={styles.statusSafety}>{copy.paymentDoNotRepurchase}</p>
          </>
        )}
      </div>
      {phase === "confirmed" ? (
        <div className={styles.actions}>
          {hasReadingReturn ? (
            <button type="button" className={styles.primaryAction} onClick={onReturnToReading}>{copy.returnReading}</button>
          ) : (
            <a href={pricingHref} className={styles.primaryAction} onClick={onFinishPricing}>{copy.backToPacks}</a>
          )}
          <a href={accountHref} className={styles.secondaryAction}>{copy.viewAccount}</a>
        </div>
      ) : phase === "delayed" ? (
        <div className={styles.actions}>
          <button type="button" className={styles.primaryAction} disabled={refreshPending} onClick={onCheckAgain}>{copy.checkAgain}</button>
          <a href={accountHref} className={styles.secondaryAction}>{copy.viewAccount}</a>
        </div>
      ) : null}
    </section>
  );
}
