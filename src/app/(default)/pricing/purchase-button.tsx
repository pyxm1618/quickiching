"use client";

import React, { useState } from "react";
import type { ProductId } from "@/domain/entitlements/pricing";
import { buildPricingSigninHref } from "@/lib/commercial-navigation";
import { getDictionary } from "@/i18n/dictionaries";
import {
  checkoutFailurePresentation,
  createCheckoutRequestIdentityStore,
} from "./checkout-request-identity";
import { buildCheckoutReturnContext, writeCheckoutReturnContext } from "./checkout-return-context";
import styles from "./purchase-button.module.css";

type CheckoutResponseBody = {
  orderId?: unknown;
  checkoutUrl?: unknown;
  expiresAt?: unknown;
  error?: unknown;
};

export function completeCheckoutNavigation(input: {
  body: CheckoutResponseBody | null;
  storage: Pick<Storage, "setItem">;
  returnUrl?: string;
  creditsBeforeCheckout: number;
  nowMs: number;
  beforeNavigate: () => void;
  navigate: (url: string) => void;
}): boolean {
  const { body, nowMs } = input;
  if (
    !Number.isFinite(nowMs)
    || typeof body?.orderId !== "string"
    || body.orderId.length === 0
    || typeof body.checkoutUrl !== "string"
    || body.checkoutUrl.length === 0
    || typeof body.expiresAt !== "string"
    || body.expiresAt.trim().length === 0
  ) {
    return false;
  }

  const expiresAt = Date.parse(body.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
    return false;
  }

  let checkoutUrl: URL;
  try {
    checkoutUrl = new URL(body.checkoutUrl);
  } catch {
    return false;
  }
  if (checkoutUrl.protocol !== "https:") {
    return false;
  }

  writeCheckoutReturnContext(input.storage as Storage, buildCheckoutReturnContext({
    returnUrl: input.returnUrl,
    creditsBeforeCheckout: input.creditsBeforeCheckout,
    orderId: body.orderId,
    createdAt: nowMs,
    expiresAt,
  }));
  input.beforeNavigate();
  input.navigate(checkoutUrl.toString());
  return true;
}

export function PurchaseButton({
  productKey,
  returnUrl,
  creditsBeforeCheckout,
  locale = "en",
}: {
  productKey: ProductId;
  returnUrl?: string;
  creditsBeforeCheckout: number;
  locale?: "en" | "zh-Hans";
}) {
  const copy = getDictionary(locale).commercial;
  const zh = locale === "zh-Hans";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function beginCheckout() {
    if (pending) return;
    setPending(true);
    setError(null);

    const requestIdentity = createCheckoutRequestIdentityStore(window.sessionStorage);
    const requestId = requestIdentity.getOrCreate(productKey);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productKey, requestId, locale }),
      });

      if (response.status === 401) {
        requestIdentity.complete(productKey);
        window.location.assign(returnUrl
          ? buildPricingSigninHref(returnUrl, locale)
          : zh ? "/zh/signin?callbackURL=%2Fzh%2Fpricing" : "/signin?callbackURL=%2Fpricing");
        return;
      }

      const body = await response.json().catch(() => null) as CheckoutResponseBody | null;

      if (!response.ok) {
        requestIdentity.retain(productKey);
        setError(checkoutFailurePresentation(response.status, locale).message);
        return;
      }

      const completed = completeCheckoutNavigation({
        body,
        storage: window.sessionStorage,
        returnUrl,
        creditsBeforeCheckout,
        nowMs: Date.now(),
        beforeNavigate: () => requestIdentity.complete(productKey),
        navigate: (url) => window.location.assign(url),
      });
      if (!completed) {
        requestIdentity.retain(productKey);
        setError(checkoutFailurePresentation(503, locale).message);
        return;
      }
    } catch {
      requestIdentity.retain(productKey);
      setError(checkoutFailurePresentation(503, locale).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        data-checkout-button="true"
        data-product-key={productKey}
        data-purchase-product={productKey}
        onClick={beginCheckout}
        disabled={pending}
        className={styles.button}
      >
        {pending ? copy.openingCheckout : copy.buyCredits}
      </button>
      {error ? <p data-checkout-error="true" className={styles.error} role="alert">{error}</p> : null}
    </div>
  );
}
