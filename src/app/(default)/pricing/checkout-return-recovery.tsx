"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearCheckoutReturnContext,
  readCheckoutReturnContext,
} from "./checkout-return-context";

const AUTO_REFRESH_WINDOW_MS = 30_000;
const AUTO_REFRESH_INTERVAL_MS = 5_000;

export function CheckoutReturnRecovery({ credits, locale = "en" }: { credits: number; locale?: "en" | "zh-Hans" }) {
  const zh = locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  const router = useRouter();
  const startedAtRef = useRef(Date.now());
  const [waiting, setWaiting] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [refreshPending, startRefreshTransition] = useTransition();
  // tick increments each time we want to re-poll, even when credits hasn't changed.
  // This forces useEffect to re-run after every router.refresh() cycle.
  const [tick, setTick] = useState(0);

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

    if (refreshPending) return;

    if (Date.now() - startedAtRef.current >= AUTO_REFRESH_WINDOW_MS) {
      setTimedOut(true);
      return;
    }

    const timer = window.setTimeout(() => {
      startRefreshTransition(() => {
        router.refresh();
        setTick((value) => value + 1);
      });
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [credits, refreshPending, router, tick]);

  if (!waiting) return null;

  if (timedOut) {
    return (
      <p className="mt-6 text-center text-sm leading-6 text-[var(--ink-2)]" role="status">
        {t("Credit confirmation is taking longer than expected.", "支付确认比预期更久。")}{" "}
        <button
          type="button"
          className="underline"
          disabled={refreshPending}
          onClick={() => {
            setTimedOut(false);
            startedAtRef.current = Date.now();
            startRefreshTransition(() => {
              router.refresh();
              setTick((value) => value + 1);
            });
          }}
        >
          {t("Check again", "再次检查")}
        </button>
        {t(", or return to your reading from", "，或者从")}{" "}
        <a href={zh ? "/zh/account" : "/account"} className="underline">{t("account history", "账户记录")}</a>{t(".", "返回你的解读。")}
      </p>
    );
  }

  return (
    <p className="mt-6 text-center text-sm leading-6 text-[var(--ink-2)]" role="status">
      {t("Payment confirmation is being checked from your account. This page will return to your reading after the credit is posted.", "正在从你的账户检查支付确认。解读次数到账后，本页面会自动返回之前的解读。")}
    </p>
  );
}
