import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { validateAuthCallbackURL } from "@/server/auth/callback";
import { loadEntitlementBalance } from "@/server/loaders";
import { isCheckoutCapabilityEnabled } from "@/server/payments/capability";
import { buildPricingView } from "./pricing-model";
import { PurchaseButton } from "./purchase-button";
import { CheckoutReturnRecovery } from "./checkout-return-recovery";

export const metadata: Metadata = {
  title: "Deep Reading Credits | Quick I Ching",
  description: "Pricing and availability for optional personalized I Ching deep-reading credits.",
  alternates: { canonical: "/pricing" },
  robots: { index: false, follow: true },
};

// Commercial capability flags are deployment-time server configuration.
export const dynamic = "force-dynamic";

function validatedReturnUrl(candidate: string | undefined): string | undefined {
  if (!candidate) return undefined;
  const baseUrl = process.env.APP_BASE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  try {
    return validateAuthCallbackURL(candidate, baseUrl);
  } catch {
    return undefined;
  }
}

export default async function PricingPage(props: {
  searchParams?: Promise<{ returnUrl?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const returnUrl = validatedReturnUrl(searchParams?.returnUrl);
  const pricing = buildPricingView(isCheckoutCapabilityEnabled());
  const user = await getCurrentUser({ allowUnavailable: true });
  const balance = user ? await loadEntitlementBalance() : { available: 0, expiringSoon: 0 };

  if (!pricing.enabled) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Commercial V2 · Not active</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">Personalized deep readings are not on sale</h1>
        <p className="mt-5 text-lg leading-8 text-[var(--ink-2)]">All four methods include a complete free general interpretation, and free readings never call AI. There is currently no production checkout, credit purchase, account requirement, or paid AI Deep Reading service.</p>
        <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-6 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--ink)]">Product boundary:</strong> if Deep Reading becomes available, it will use your frozen core question, situation, interpretation goal, exact cast, changing lines, relating hexagram, and cited I Ching material to explain what the cast means for your specific situation. It will support Three-Coin readings only. Purchase terms will appear here only when checkout is active.</div>
        <p className="mt-8 text-sm leading-7 text-[var(--ink-2)]"><Link href="/" className="font-semibold text-[var(--jade)] hover:underline">Return to the free I Ching online reading</Link>.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Personalized Deep Reading</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">Choose a reading credit pack</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">
        Personalized Deep Reading addresses what your cast means for your specific situation. It combines the core question frozen before casting, the situation and interpretation goal you supply, your exact Three-Coin cast and moving lines, any relating hexagram, and cited Quick I Ching source material. The free interpretation still explains the cast itself and never calls AI.
      </p>
      <ul className="mt-4 grid gap-2 text-sm leading-6 text-[var(--ink-2)] sm:grid-cols-2" data-deep-reading-scope>
        <li>• Your question and real-world context</li>
        <li>• Exact Three-Coin cast facts and changing lines</li>
        <li>• Primary and relating hexagram source material</li>
        <li>• Evidence-backed, conditional guidance and signals to watch</li>
      </ul>
      <p className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--paper-raised)] p-4 text-sm leading-6 text-[var(--ink-2)]">Currently supported method: <strong className="text-[var(--ink)]">Three-Coin only</strong>. Other methods remain fully available as free readings and cannot be purchased for Deep Reading.</p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {pricing.products.map((product) => (
          <article key={product.id} className="relative rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-6">
            {product.badge ? (
              <p className="mb-3 inline-flex rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--bronze)]">{product.badge}</p>
            ) : null}
            <h2 className="font-display text-2xl font-medium">{product.quantity} {product.quantity === 1 ? "reading" : "readings"}</h2>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{product.total}</p>
            <p className="mt-1 text-sm text-[var(--ink-3)]">{product.perReading} per reading · USD</p>
            <p className="mt-4 min-h-6 text-sm font-medium text-[var(--ink-2)]">{product.label}</p>
            <PurchaseButton
              productKey={product.id}
              returnUrl={returnUrl}
              creditsBeforeCheckout={balance.available}
            />
          </article>
        ))}
      </div>

      <CheckoutReturnRecovery credits={balance.available} />

      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-6 text-sm leading-7 text-[var(--ink-2)]">
        Credits are valid for 12 months from successful payment. Checkout requires sign-in. A credit is reserved when a paid Deep Reading starts and is consumed only after the reading is successfully delivered; failed or blocked generation releases the reservation.
      </div>
      <p className="mt-8 text-sm leading-7 text-[var(--ink-2)]"><Link href="/" className="font-semibold text-[var(--jade)] hover:underline">Return to the free I Ching online reading</Link>.</p>
    </section>
  );
}
