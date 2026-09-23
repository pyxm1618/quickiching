import { describe, expect, it } from "vitest";
import { buildPricingView } from "./pricing-model";

describe("commercial pricing view", () => {
  it("keeps purchase actions hidden when checkout is disabled", () => {
    expect(buildPricingView(false)).toEqual({ enabled: false, products: [] });
  });

  it("exposes all canonical credit packs when checkout is enabled", () => {
    expect(buildPricingView(true)).toEqual({
      enabled: true,
      products: [
        { id: "one", quantity: 1, total: "$2.99", perReading: "$2.99", label: "First Reading", badge: null },
        { id: "three", quantity: 3, total: "$6.99", perReading: "$2.33", label: "Save about 22%", badge: "Popular" },
        { id: "five", quantity: 5, total: "$9.99", perReading: "$2.00", label: "Best Value", badge: "Best Value" },
      ],
    });
  });
});
