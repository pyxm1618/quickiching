import { PRODUCTS, formatUsd, perReadingUsd, type ProductId } from "@/domain/entitlements/pricing";

export type PricingProductView = {
  id: ProductId;
  quantity: number;
  total: string;
  perReading: string;
  label: string;
  badge: string | null;
};

export type PricingView = {
  enabled: boolean;
  products: PricingProductView[];
};

const PRODUCT_ORDER: ProductId[] = ["one", "three", "five"];

export function buildPricingView(enabled: boolean): PricingView {
  if (!enabled) return { enabled: false, products: [] };

  return {
    enabled: true,
    products: PRODUCT_ORDER.map((id) => {
      const product = PRODUCTS[id];
      return {
        id: product.id,
        quantity: product.quantity,
        total: formatUsd(product.unitPriceUsd),
        perReading: perReadingUsd(product),
        label: product.label,
        badge: product.badge,
      };
    }),
  };
}
