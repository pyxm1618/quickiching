import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { PurchaseView, canRequestRefund } from "./purchase-view";
import { SettingsView } from "./settings-view";
import type { AccountPurchase } from "@/server/account/purchase-loader";
const purchase: AccountPurchase = { id: "order", productKey: "three", quantity: 3, amountMinor: 999, currency: "USD", status: "paid", paidAt: new Date(), createdAt: new Date(), refund: null };
const account = { email: "owner@example.com", signInMethods: ["Google", "Email (Magic Link)"], balance: { available: 3, expiringSoon: 0 }, purchases: [purchase] };
describe("Account views", () => {
  it("renders real loader values and supplied coins, without validity date or casting stats", () => {
    const html = renderToStaticMarkup(<PurchaseView account={account} selectedPurchase={null} onSelectPurchase={() => {}} zh={false} onClose={() => {}} />);
    expect(html).toContain("owner@example.com"); expect(html).toContain("Google + Email (Magic Link)"); expect(html).toContain("US$9.99"); expect(html).toContain("Request Refund"); expect(html).not.toContain("Valid"); expect(html).not.toContain("Casts");
  });
  it("shows refund form in the same view with empty reason disabled", () => {
    const html = renderToStaticMarkup(<PurchaseView account={account} selectedPurchase={purchase} onSelectPurchase={() => {}} zh={false} onClose={() => {}} />);
    expect(html).toContain("← Back to My Account"); expect(html).toContain("textarea"); expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Submit for Manual Review/); expect(html).not.toContain("<dialog");
  });
  it("preserves refund window boundaries and suppresses duplicate/pending requests", () => {
    const paidAt = new Date("2026-10-01T00:00:00Z"); const start = paidAt.getTime(); const eligible = { ...purchase, paidAt };
    expect(canRequestRefund(eligible, start)).toBe(true); expect(canRequestRefund(eligible, start + 7 * 86400000)).toBe(true);
    expect(canRequestRefund(eligible, start - 1)).toBe(false); expect(canRequestRefund(eligible, start + 7 * 86400000 + 1)).toBe(false);
    expect(canRequestRefund({ ...eligible, status: "pending" }, start)).toBe(false);
    expect(canRequestRefund({ ...eligible, refund: { id: "refund", status: "manual_review", autoScreen: "clear", screenReason: null } }, start)).toBe(false);
    expect(canRequestRefund({ ...eligible, paidAt: null }, start)).toBe(false);
  });
  it("limits Settings to requested controls", () => {
    const html = renderToStaticMarkup(<SettingsView deleting={false} onDeleteView={() => {}} zh={false} onClose={() => {}} />);
    for (const label of ["Privacy Policy", "Terms of Service", "Sign Out", "Delete Account"]) expect(html).toContain(label);
    expect(html).not.toMatch(/Notifications|Appearance|Billing|Export Data|<dialog/);
  });
  it("keeps Delete Account as a secondary view with exact confirmation and disabled action", () => {
    const html = renderToStaticMarkup(<SettingsView deleting onDeleteView={() => {}} zh={false} onClose={() => {}} />);
    expect(html).toContain("← Back to Settings"); expect(html).toContain("This action is permanent and cannot be undone.");
    expect(html).toContain("Type DELETE to confirm"); expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Permanently Delete Account/); expect(html).not.toContain("<dialog");
  });
});
