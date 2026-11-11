import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { buildPricingView } from "@/app/(default)/pricing/pricing-model";
import { PricingExperience } from "./pricing-experience";

function render(locale: "en" | "zh-Hans", signedIn: boolean, balance = 0) {
  return renderToStaticMarkup(<PricingExperience
    locale={locale}
    pricing={buildPricingView(true)}
    signedIn={signedIn}
    balance={balance}
  />);
}

describe("PricingExperience formal UI", () => {
  it("renders canonical 1 / 3 / 5 packs and prices without feature-tier semantics", () => {
    const html = render("en", true, 4);
    for (const [pack, price, per] of [
      ["one", "$2.99", "$2.99"],
      ["three", "$6.99", "$2.33"],
      ["five", "$9.99", "$2.00"],
    ]) {
      expect(html).toContain(`data-pack="${pack}"`);
      expect(html).toContain(price);
      expect(html).toContain(per);
    }
    expect(html.match(/data-checkout-button="true"/g)?.length).toBe(3);
    expect(html).toContain("Same Deep Reading. Choose only how many credits you want.");
    expect(html).not.toMatch(/\bBasic\b|\bPro\b|\bPremium\b|subscription plan/i);
  });

  it("shows the real signed-in balance", () => {
    const html = render("en", true, 4);
    expect(html).toContain('data-balance-state="signed-in"');
    expect(html).toContain('data-balance-credits="4"');
  });

  it("never presents a signed-out visitor as zero credits", () => {
    const html = render("en", false, 0);
    expect(html).toContain('data-balance-state="signed-out"');
    expect(html).toContain("Sign in to view your balance");
    expect(html).not.toContain('data-balance-credits="0"');
    expect(html).not.toContain('data-balance-credits="0"');
  });

  it("renders localized Chinese copy with identical canonical prices", () => {
    const html = render("zh-Hans", true, 2);
    expect(html).toContain("深度解读次数");
    expect(html).toContain("三种选择是同一种深度解读，只是购买次数不同");
    expect(html).toContain("$2.99");
    expect(html).toContain("$6.99");
    expect(html).toContain("$9.99");
    expect(html.match(/data-checkout-button="true"/g)?.length).toBe(3);
    expect(html).toContain("三枚铜钱 · 蓍草 · 梅花易数 · 手动起卦");
  });

  it("states one-time purchase, 12-month validity, success-only consumption and all four methods", () => {
    const html = render("en", true, 1);
    expect(html).toContain("One-time purchase. No subscription or automatic renewal.");
    expect(html).toContain("12 months");
    expect(html).toContain("consumed only after successful delivery");
    expect(html).toContain("Three-Coin · Yarrow Stalks · Mei Hua Yi Shu · Manual Cast");
  });
});
