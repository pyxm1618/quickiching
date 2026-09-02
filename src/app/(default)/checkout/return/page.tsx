import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isCheckoutCapabilityEnabled } from "@/server/payments/capability";
import { CheckoutReturn } from "./checkout-return";

export const metadata: Metadata = {
  title: "Payment received",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function CheckoutReturnPage() {
  // Defence in depth: middleware already answers 404 here while checkout is
  // closed, but the page must not exist on its own either.
  if (!isCheckoutCapabilityEnabled()) notFound();

  return (
    <section className="mx-auto max-w-2xl px-4 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Checkout</p>
      <h1 className="mt-3 font-display text-3xl font-medium tracking-tight">Back from payment</h1>
      <CheckoutReturn />
    </section>
  );
}
