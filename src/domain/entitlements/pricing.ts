// §13.1 / PRD §13.1 Server-side product configuration. The single source of truth for price,
// quantity and currency. Front-end is never trusted for price/quantity/currency/product id.

export type ProductId = "one" | "three" | "five";

export type ProductConfig = {
  id: ProductId;
  quantity: number;
  unitPriceUsd: number; // base price in dollars
  label: string;
  badge: string | null;
};

export const CURRENCY = "USD";
export const ENTITLEMENT_VALIDITY_MONTHS = 12;

export const PRODUCTS: Record<ProductId, ProductConfig> = {
  one: { id: "one", quantity: 1, unitPriceUsd: 2.99, label: "First Reading", badge: null },
  three: { id: "three", quantity: 3, unitPriceUsd: 6.99, label: "Save about 22%", badge: "Popular" },
  five: { id: "five", quantity: 5, unitPriceUsd: 9.99, label: "Best Value", badge: "Best Value" },
};

export function getProduct(id: string): ProductConfig | null {
  if (id === "one" || id === "three" || id === "five") return PRODUCTS[id];
  return null;
}

// Display helpers keep totals and per-reading equivalents consistent with the pricing page.
export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function perReadingUsd(p: ProductConfig): string {
  return `$${((p.unitPriceUsd / p.quantity) * 1).toFixed(2)}`;
}

// §13.2 Entitlement validity: 12 months from successful payment.
export function entitlementExpiry(purchasedAt: Date): Date {
  const d = new Date(purchasedAt.getTime());
  d.setMonth(d.getMonth() + ENTITLEMENT_VALIDITY_MONTHS);
  return d;
}

// §13.7 Compensation batch expiry: later of original batch expiry and grantedAt + 30 days.
export function compensationExpiry(originalExpiry: Date, grantedAt: Date): Date {
  const plus30 = new Date(grantedAt.getTime());
  plus30.setDate(plus30.getDate() + 30);
  return plus30.getTime() > originalExpiry.getTime() ? plus30 : originalExpiry;
}
