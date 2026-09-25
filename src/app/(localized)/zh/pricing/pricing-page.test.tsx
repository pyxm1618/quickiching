import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock server auth and loaders
const mockUser = vi.fn();
const mockBalance = vi.fn();
const mockCheckoutCapability = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: () => mockUser(),
}));

vi.mock("@/server/loaders", () => ({
  loadEntitlementBalance: () => mockBalance(),
}));

vi.mock("@/server/payments/capability", () => ({
  isCheckoutCapabilityEnabled: () => mockCheckoutCapability(),
}));

import ChinesePricingPage from "./page";

describe("ChinesePricingPage (Server Component) preview isolation and security gate", () => {
  const originalEnv = process.env.CHINESE_INTERACTIVE_GATE_PRICING_PREVIEW;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.mockResolvedValue(null);
    mockBalance.mockResolvedValue({ available: 0, expiringSoon: 0 });
    mockCheckoutCapability.mockReturnValue(false); // Commercial checkout disabled by default
    delete process.env.CHINESE_INTERACTIVE_GATE_PRICING_PREVIEW;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CHINESE_INTERACTIVE_GATE_PRICING_PREVIEW = originalEnv;
    } else {
      delete process.env.CHINESE_INTERACTIVE_GATE_PRICING_PREVIEW;
    }
  });

  it("without test env: visiting /zh/pricing?preview=1 remains closed and does NOT render PurchaseButton", async () => {
    delete process.env.CHINESE_INTERACTIVE_GATE_PRICING_PREVIEW;

    const vnode = await ChinesePricingPage({
      searchParams: Promise.resolve({ preview: "1" }),
    });
    const html = renderToStaticMarkup(vnode);

    expect(html).toContain("商业功能 · 当前未启用");
    expect(html).toContain("个性化深度解读当前未开放购买");
    expect(html).not.toContain("data-checkout-button");
    expect(html).not.toContain("购买深度解读次数");
  });

  it("without test env: default /zh/pricing remains closed", async () => {
    delete process.env.CHINESE_INTERACTIVE_GATE_PRICING_PREVIEW;

    const vnode = await ChinesePricingPage({});
    const html = renderToStaticMarkup(vnode);

    expect(html).toContain("商业功能 · 当前未启用");
    expect(html).toContain("个性化深度解读当前未开放购买");
    expect(html).not.toContain("data-checkout-button");
  });

  it("with test env enabled: visiting without preview param stays closed", async () => {
    process.env.CHINESE_INTERACTIVE_GATE_PRICING_PREVIEW = "1";

    const vnode = await ChinesePricingPage({});
    const html = renderToStaticMarkup(vnode);

    expect(html).toContain("商业功能 · 当前未启用");
    expect(html).toContain("个性化深度解读当前未开放购买");
    expect(html).not.toContain("data-checkout-button");
  });

  it("with test env enabled: visiting with preview=1 unlocks PurchaseButton for test automation", async () => {
    process.env.CHINESE_INTERACTIVE_GATE_PRICING_PREVIEW = "1";

    const vnode = await ChinesePricingPage({
      searchParams: Promise.resolve({ preview: "1" }),
    });
    const html = renderToStaticMarkup(vnode);

    expect(html).toContain("个性化深度解读");
    expect(html).toContain("选择深度解读次数包");
    expect(html).toContain('data-checkout-button="true"');
    expect(html).toContain("购买深度解读次数");
  });
});
