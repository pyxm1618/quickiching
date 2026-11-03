import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), readings: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/server/loaders", () => ({ loadMyReadings: mocks.readings }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); } }));
import { MyReadingsPage } from "./my-readings-page";
describe("My Readings page", () => {
  beforeEach(() => { mocks.user.mockResolvedValue({ id: "owner", email: "owner@example.com" }); });
  it("renders the approved cast summary from fields already loaded for each reading", async () => {
    mocks.readings.mockResolvedValue([
      {
        id: "first", question: "Should I change jobs?", createdAt: new Date("2026-10-28"), method: "three_coin",
        primaryHexagramNumber: 1, primaryName: "The Creative", lineValues: [7, 7, 9, 7, 7, 7],
        movingLinePositions: [3], relatingHexagramNumber: 10, relatingName: "Treading", hasReading: true,
      },
      {
        id: "second", question: null, createdAt: new Date("2026-10-27"), method: "three_coin",
        primaryHexagramNumber: 2, primaryName: "The Receptive", lineValues: [8, 8, 8, 8, 8, 8],
        movingLinePositions: [], relatingHexagramNumber: null, relatingName: null,
      },
    ]);
    const html = renderToStaticMarkup(await MyReadingsPage({}));
    expect(html).toContain("Should I change jobs?");
    expect(html).toContain("Untitled Reading");
    expect(html).toContain("Oct 28, 2026");
    expect(html).toContain("The Creative");
    expect(html).toContain("Lines 3");
    expect(html).toContain("Treading");
    expect(html).toContain("Three-Coin Method");
    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).toContain("/readings/result?session=first");
    expect(html).not.toContain("/readings/three-coin/result");
    expect(html).not.toMatch(/Preview|Get Deep Reading|View Deep Reading/);
  });
  it("uses Chinese routes without adding an empty-state CTA", async () => {
    mocks.readings.mockResolvedValue([]);
    const html = renderToStaticMarkup(await MyReadingsPage({ zh: true }));
    expect(html).toContain("我的解读"); expect(html).not.toContain("<a ");
  });
  it("requires the user's session before reading My Readings", async () => {
    mocks.user.mockResolvedValue(null); mocks.readings.mockClear();
    await expect(MyReadingsPage({})).rejects.toThrow("NEXT_REDIRECT:/signin?callbackURL=%2Fmy-readings"); expect(mocks.readings).not.toHaveBeenCalled();
  });
});
