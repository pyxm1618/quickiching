"use server";

import Link from "next/link";
import { CircleDollarSign, Gem, Layers3 } from "lucide-react";
import type { PricingView } from "@/app/(default)/pricing/pricing-model";
import { CheckoutReturnRecovery } from "@/app/(default)/pricing/checkout-return-recovery";
import { PurchaseButton } from "@/app/(default)/pricing/purchase-button";
import { getDictionary } from "@/i18n/dictionaries";
import styles from "./commercial-ui.module.css";

type Locale = "en" | "zh-Hans";

export async function PricingExperience({
  locale,
  pricing,
  signedIn,
  balance,
  returnUrl,
  orderId,
}: {
  locale: Locale;
  pricing: PricingView;
  signedIn: boolean;
  balance: number;
  returnUrl?: string;
  orderId?: string;
}) {
  const copy = getDictionary(locale).commercial;
  const prefix = locale === "zh-Hans" ? "/zh" : "";
  const pricingPath = prefix + "/pricing";
  const signInHref = prefix + "/signin?callbackURL=" + encodeURIComponent(pricingPath);
  const paymentReturn = Boolean(orderId);

  const packLabel = (id: "one" | "three" | "five") =>
    id === "one" ? copy.packOneLabel : id === "three" ? copy.packThreeLabel : copy.packFiveLabel;
  const badge = (id: "one" | "three" | "five") =>
    id === "three" ? copy.popularBadge : id === "five" ? copy.bestValueBadge : null;
  const creditsLabel = (quantity: number) =>
    quantity === 1 ? copy.creditSingular : copy.creditPlural;

  return (
    <main className={styles.pricingPage} data-pricing-formal-ui="true">
      <div className={styles.shell}>
        <header className={styles.hero}>
          <p className={styles.kicker}>{copy.pricingKicker}</p>
          <h1 className={styles.title}>{copy.pricingTitle}</h1>
          {!paymentReturn ? <p className={styles.intro}>{copy.pricingIntro}</p> : null}

          {!paymentReturn ? (
            <section className={styles.balanceCard} aria-label={copy.currentBalance} data-balance-state={signedIn ? "signed-in" : "signed-out"}>
              <div>
                <p className={styles.balanceLabel}>{copy.currentBalance}</p>
                {signedIn ? (
                  <>
                    <div className={styles.balanceValue} data-balance-credits={balance}>
                      <span className={styles.balanceCount}>{balance}</span>
                      <span className={styles.balanceUnit}>{balance === 1 ? copy.creditSingular : copy.creditPlural}</span>
                    </div>
                    <p className={styles.balanceMeta}>{copy.available}</p>
                  </>
                ) : (
                  <>
                    <div className={styles.balanceValue}><span className={styles.balanceUnit}>{copy.signedOutBalance}</span></div>
                    <p className={styles.balanceMeta}>{copy.signedOutBalanceNote}</p>
                  </>
                )}
              </div>
              {!signedIn ? <Link href={signInHref} className={styles.signInLink}>{copy.signIn}</Link> : <Gem aria-hidden="true" size={30} />}
            </section>
          ) : null}
        </header>

        {paymentReturn ? (
          <CheckoutReturnRecovery credits={balance} locale={locale} orderId={orderId} />
        ) : pricing.enabled ? (
          <>
            <div className={styles.sectionLead}>
              <h2>{copy.sameProduct}</h2>
            </div>

            <section className={styles.packGrid} aria-label={copy.pricingTitle}>
              {pricing.products.map((product) => {
                const localizedBadge = badge(product.id);
                return (
                  <article key={product.id} className={[styles.packCard, product.id === "five" ? styles.packFeatured : ""].filter(Boolean).join(" ")} data-pack={product.id}>
                    {localizedBadge ? <span className={styles.badge}>{localizedBadge}</span> : null}
                    <p className={styles.quantity}>{product.quantity} {creditsLabel(product.quantity)}</p>
                    <h2 className={styles.packTitle}>{packLabel(product.id)}</h2>
                    <p className={styles.price}>{product.total}</p>
                    <p className={styles.perReading}>{product.perReading} · {copy.perDeepReading}</p>
                    <p className={styles.packLabel}>{packLabel(product.id)}</p>
                    <p className={styles.oneTime}>{copy.oneTimePurchase}</p>
                    <PurchaseButton
                      productKey={product.id}
                      returnUrl={returnUrl}
                      creditsBeforeCheckout={balance}
                      locale={locale}
                    />
                  </article>
                );
              })}
            </section>

            <section className={styles.terms}>
              <div><CircleDollarSign aria-hidden="true" size={22} /><h2>{copy.termsTitle}</h2></div>
              <div><p>{copy.termsOneTime}</p></div>
              <div><p>{copy.termsValidity}</p></div>
              <div><p>{copy.termsConsumption}</p></div>
            </section>

            <section aria-labelledby="free-vs-deep-heading">
              <div className={styles.sectionLead}>
                <h2 id="free-vs-deep-heading">{copy.freeVsDeepTitle}</h2>
              </div>
              <div className={styles.compare}>
                <article className={styles.compareCard}>
                  <h3>{copy.freeTitle}</h3>
                  <p>{copy.freeDescription}</p>
                </article>
                <article className={styles.compareCard}>
                  <h3>{copy.deepTitle}</h3>
                  <p>{copy.deepDescription}</p>
                </article>
              </div>
              <div className={styles.methods}>
                <Layers3 aria-hidden="true" size={22} />
                <strong>{copy.methodsTitle}</strong>
                <span>{copy.methodsDescription}</span>
              </div>
            </section>
          </>
        ) : (
          <section className={styles.unavailable}>
            <p className={styles.kicker}>{copy.unavailableKicker}</p>
            <h2>{copy.unavailableTitle}</h2>
            <p>{copy.unavailableDescription}</p>
          </section>
        )}

        {!paymentReturn ? <Link href={prefix || "/"} className={styles.backLink}>{copy.returnFree}</Link> : null}
      </div>
    </main>
  );
}
