export function buildResultSigninHref(returnPath: string): string {
  return `/signin?callbackURL=${encodeURIComponent(returnPath)}`;
}

export function buildPricingHref(returnPath: string): string {
  return `/pricing?returnUrl=${encodeURIComponent(returnPath)}`;
}

export function buildPricingSigninHref(returnPath: string): string {
  return `/signin?callbackURL=${encodeURIComponent(buildPricingHref(returnPath))}`;
}
