import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAccountModal } from "./fetch-account-modal";
afterEach(() => vi.unstubAllGlobals());
describe("on-demand Account response validation", () => {
  it("rejects missing data rather than synthesizing credits, providers or purchases", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ email: "owner@example.com" })));
    await expect(fetchAccountModal()).rejects.toThrow();
  });
  it("rejects failed requests", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })));
    await expect(fetchAccountModal()).rejects.toThrow("ACCOUNT_UNAVAILABLE");
  });
  it("preserves real empty arrays and zero credits", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ email: "owner@example.com", balance: { available: 0, expiringSoon: 0 }, purchases: [], signInMethods: [] }));
    vi.stubGlobal("fetch", fetch);
    expect(await fetchAccountModal()).toEqual({ email: "owner@example.com", balance: { available: 0, expiringSoon: 0 }, purchases: [], signInMethods: [] });
    expect(fetch).toHaveBeenCalledWith("/api/user/me?view=account", { cache: "no-store", credentials: "same-origin" });
  });
});
