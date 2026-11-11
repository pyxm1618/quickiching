import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { validateAuthCallbackURL } from "@/server/auth/callback";
import { loadEntitlementBalance } from "@/server/loaders";
import { isCheckoutCapabilityEnabled } from "@/server/payments/capability";
import { PricingExperience } from "@/components/commercial/pricing-experience";
import { buildPricingView } from "./pricing-model";

export const metadata: Metadata = {
  title: "Deep Reading Credits | Quick I Ching",
  description: "Pricing and availability for Deep Reading credits that connect an I Ching cast to your specific question and situation.",
  alternates: { canonical: "/pricing" },
  robots: { index: false, follow: true },
};

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
  searchParams?: Promise<{ returnUrl?: string; orderId?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const returnUrl = validatedReturnUrl(searchParams?.returnUrl);
  const pricing = buildPricingView(isCheckoutCapabilityEnabled());
  const user = await getCurrentUser({ allowUnavailable: true });
  const balance = user ? await loadEntitlementBalance(user) : { available: 0, expiringSoon: 0 };

  return (
    <PricingExperience
      locale="en"
      pricing={pricing}
      signedIn={Boolean(user)}
      balance={balance.available}
      returnUrl={returnUrl}
      orderId={searchParams?.orderId}
    />
  );
}
