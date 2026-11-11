import React from "react";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { validateAuthCallbackURL } from "@/server/auth/callback";
import { loadEntitlementBalance } from "@/server/loaders";
import { isCheckoutCapabilityEnabled } from "@/server/payments/capability";
import { PricingExperience } from "@/components/commercial/pricing-experience";
import { buildPricingView } from "@/app/(default)/pricing/pricing-model";

export const metadata: Metadata = {
  title: "深度解读次数与价格 | Quick I Ching",
  description: "查看 Quick I Ching 可选个性化深度解读次数包的当前可用状态、价格、有效期与支付说明。",
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

export default async function ChinesePricingPage(props: {
  searchParams?: Promise<{ returnUrl?: string; orderId?: string; preview?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const returnUrl = validatedReturnUrl(searchParams?.returnUrl);
  const testPreviewAllowed = process.env.CHINESE_INTERACTIVE_GATE_PRICING_PREVIEW === "1";
  const isPreview = testPreviewAllowed && (searchParams?.preview === "1" || searchParams?.preview === "true");
  const pricing = buildPricingView(isCheckoutCapabilityEnabled() || isPreview);
  const user = await getCurrentUser({ allowUnavailable: true });
  const balance = user ? await loadEntitlementBalance(user) : { available: 0, expiringSoon: 0 };

  return (
    <PricingExperience
      locale="zh-Hans"
      pricing={pricing}
      signedIn={Boolean(user)}
      balance={balance.available}
      returnUrl={returnUrl}
      orderId={searchParams?.orderId}
    />
  );
}
