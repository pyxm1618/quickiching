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

      const body = await response.json().catch(() => null) as {
        orderId?: unknown;
        checkoutUrl?: unknown;
        error?: unknown;
      } | null;

      if (!response.ok || typeof body?.checkoutUrl !== "string" || typeof body.orderId !== "string") {
        requestIdentity.retain(productKey);
        setError(checkoutFailurePresentation(response.status, locale).message);
        return;
      }

      const checkoutUrl = new URL(body.checkoutUrl);
      if (checkoutUrl.protocol !== "https:") {
        requestIdentity.retain(productKey);
        setError(checkoutFailurePresentation(503, locale).message);
        return;
      }

      writeCheckoutReturnContext(window.sessionStorage, buildCheckoutReturnContext({
        returnUrl,
        creditsBeforeCheckout,
        orderId: body.orderId,
        createdAt: Date.now(),
      }));

      requestIdentity.complete(productKey);
      window.location.assign(checkoutUrl.toString());
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
