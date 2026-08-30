import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRODUCTS } from "@/domain/entitlements/pricing";

const mocks = vi.hoisted(() => ({ enabled: false }));

vi.mock("@/server/payments/capability", () => ({
  isCheckoutCapabilityEnabled: () => mocks.enabled,
}));

import PricingPage, { metadata } from "./page";

function visibleText(): string {
  return renderToStaticMarkup(<PricingPage />)
    .replace(/<[^>]+>/gu, " ")
    .replace(/&#x27;|&#39;/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Collect the props of every element in the unrendered tree. */
function propsOf(node: unknown, found: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!node || typeof node !== "object") return found;
  if (Array.isArray(node)) {
    for (const child of node) propsOf(child, found);
    return found;
  }
  const element = node as { props?: Record<string, unknown> };
  if (element.props) {
    found.push(element.props);
    propsOf(element.props.children, found);
  }
  return found;
}

function tierProps(): Record<string, unknown>[] {
  const panel = propsOf(PricingPage()).find((props) => Array.isArray(props.tiers));
  return (panel?.tiers ?? []) as Record<string, unknown>[];
}

afterEach(() => vi.restoreAllMocks());

describe("pricing page while checkout is closed", () => {
  beforeEach(() => { mocks.enabled = false; });

  it("keeps the Public V1 not-on-sale notice", () => {
    const text = visibleText();

    expect(text).toContain("Personalized deep readings are not on sale");
    expect(text).toContain("There is currently no production checkout");
  });

  it("shows no price and no buy control", () => {
    const text = visibleText();

    expect(text).not.toContain("$");
    expect(text).not.toContain("Buy");
  });

  it("hands no product identity to the client", () => {
    expect(tierProps()).toEqual([]);
    expect(JSON.stringify(propsOf(PricingPage()))).not.toContain("productKey");
  });

  it("stays out of the index", () => {
    expect(metadata.robots).toMatchObject({ index: false });
  });
});

describe("pricing page while checkout is open", () => {
  beforeEach(() => { mocks.enabled = true; });

  it("replaces the notice with the credit tiers", () => {
    const text = visibleText();

    expect(text).toContain("Buy reading credits");
    expect(text).not.toContain("not on sale");
  });

  it("shows every price from the server-side product table", () => {
    const text = visibleText();

    for (const product of Object.values(PRODUCTS)) {
      expect(text).toContain(`$${product.unitPriceUsd.toFixed(2)}`);
    }
  });

  it("passes every product through in the table's own order", () => {
    const tiers = tierProps();

    expect(tiers.map((tier) => tier.productKey)).toEqual(["one", "three", "five"]);
    for (const tier of tiers) {
      const product = PRODUCTS[tier.productKey as "one" | "three" | "five"];
      expect(tier.quantity).toBe(product.quantity);
      expect(tier.totalLabel).toBe(`$${product.unitPriceUsd.toFixed(2)}`);
    }
  });

  it("hands the client finished labels, never figures it could recompute or a provider id", () => {
    for (const tier of tierProps()) {
      expect(tier).not.toHaveProperty("unitPriceUsd");
      expect(tier).not.toHaveProperty("amountMinor");
      expect(tier).not.toHaveProperty("providerProductId");
    }
  });

  it("says where payment happens rather than implying it is on our site", () => {
    expect(visibleText()).toContain("Checkout opens in a new tab");
  });

  it("still stays out of the index", () => {
    expect(metadata.robots).toMatchObject({ index: false });
  });
});
