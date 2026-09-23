export function buildResultSigninHref(returnPath: string, locale: "en" | "zh-Hans" = "en"): string {
  const prefix = locale === "zh-Hans" || returnPath.startsWith("/zh") ? "/zh" : "";
  return `${prefix}/signin?callbackURL=${encodeURIComponent(returnPath)}`;
}

export function buildPricingHref(returnPath: string, locale: "en" | "zh-Hans" = "en"): string {
  const prefix = locale === "zh-Hans" || returnPath.startsWith("/zh") ? "/zh" : "";
  return `${prefix}/pricing?returnUrl=${encodeURIComponent(returnPath)}`;
}

export function buildPricingSigninHref(returnPath: string, locale: "en" | "zh-Hans" = "en"): string {
  const prefix = locale === "zh-Hans" || returnPath.startsWith("/zh") ? "/zh" : "";
  return `${prefix}/signin?callbackURL=${encodeURIComponent(buildPricingHref(returnPath, locale))}`;
}
