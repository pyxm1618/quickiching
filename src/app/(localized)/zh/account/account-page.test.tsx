import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  useRouter: () => ({ refresh: vi.fn() }),
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
const mockHistory = vi.fn();
const mockBalance = vi.fn();
const mockPurchases = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: () => mockUser(),
}));

vi.mock("@/server/loaders", () => ({
  loadHistory: () => mockHistory(),
  loadEntitlementBalance: () => mockBalance(),
}));

vi.mock("@/server/account/purchase-loader", () => ({
  loadAccountPurchases: () => mockPurchases(),
}));

import ChineseAccountPage from "./page";

function stripAllowedLatin(text: string): string {
  const ALLOWED = [
    "Quick I Ching",
    "QuickIChing",
    "Google",
    "Microsoft",
    "Waffo",
    "IANA",
    "Adsterra",
    "Unicode",
    "UTC",
    "URL",
    "API",
    "JSON",
    "AI",
    "ID",
  ];
  let res = text.replace(/https?:\/\/\S+/giu, " ");
  res = res.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, " ");
  for (const allowed of ALLOWED) {
    res = res.split(allowed).join(" ");
  }
  return res;
}

function findLatinContamination(html: string): string[] {
  // Strip tags and quotes
  const text = html.replace(/<[^>]+>/g, " ");
  const cleaned = stripAllowedLatin(text);
  const matches = cleaned.match(/\p{Script=Latin}[\p{Script=Latin}\p{M}'’\-]*/gu) ?? [];
  return [...new Set(matches.filter((w) => w.length >= 2))];
}

describe("ChineseAccountPage Server Component", () => {
  it("renders pure Chinese view with empty purchases and empty history", async () => {
    mockUser.mockResolvedValue({ id: "usr_test_1", email: "user@example.com" });
    mockHistory.mockResolvedValue([]);
    mockBalance.mockResolvedValue({ available: 0, expiringSoon: 0 });
    mockPurchases.mockResolvedValue([]);

    const component = await ChineseAccountPage();
    const html = renderToStaticMarkup(component);

    expect(html).toContain("我的账户");
    expect(html).toContain("可用深度解读次数");
    expect(html).toContain("账户起卦记录");
    expect(html).toContain("还没有购买记录。");
    expect(html).toContain("还没有账户起卦记录。");
    expect(html).toContain("删除账户");
    expect(html).toContain('href="/zh/pricing"');
    expect(html).toContain('href="/zh/methods/three-coin"');
    expect(html).toContain('href="/zh/privacy"');

    const contamination = findLatinContamination(html);
    expect(contamination).toEqual([]);
  });

  it("renders pure Chinese view with active purchases and history records", async () => {
    mockUser.mockResolvedValue({ id: "usr_test_2", email: "vip@example.com" });
    mockBalance.mockResolvedValue({ available: 3, expiringSoon: 0 });
    mockPurchases.mockResolvedValue([
      {
        id: "ord_101",
        quantity: 3,
        amountMinor: 1500,
        status: "paid",
        paidAt: new Date("2026-09-20T10:00:00Z"),
        createdAt: new Date("2026-09-20T09:55:00Z"),
        refund: null,
      },
    ]);
    mockHistory.mockResolvedValue([
      {
        id: "hist_1",
        method: "three-coin",
        scene: "career",
        createdAt: new Date("2026-09-21T08:00:00Z"),
        primaryName: "乾为天",
        hasPreview: true,
        hasReading: true,
      },
    ]);

    const component = await ChineseAccountPage();
    const html = renderToStaticMarkup(component);

    expect(html).toContain("3 次深度解读");
    expect(html).toContain("美元 15.00");
    expect(html).toContain("已付款");
    expect(html).toContain("乾为天");
    expect(html).toContain("三枚铜钱 · 事业");
    expect(html).toContain("预览");
    expect(html).toContain("解读");
    expect(html).toContain('href="/zh/readings/three-coin/result?session=hist_1"');

    const contamination = findLatinContamination(html);
    expect(contamination).toEqual([]);
  });

  it("redirects unauthenticated user to /zh/signin", async () => {
    const { redirect } = await import("next/navigation");
    mockUser.mockResolvedValue(null);

    await expect(ChineseAccountPage()).rejects.toThrow("NEXT_REDIRECT:/zh/signin?callbackURL=%2Fzh%2Faccount");
    expect(redirect).toHaveBeenCalledWith("/zh/signin?callbackURL=%2Fzh%2Faccount");
  });
});
