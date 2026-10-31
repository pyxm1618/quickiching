import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), history: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/server/loaders", () => ({ loadHistory: mocks.history }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); } }));
import { MyReadingsPage } from "./my-readings-page";
describe("My Readings page", () => {
  beforeEach(() => { mocks.user.mockResolvedValue({ id: "owner", email: "owner@example.com" }); });
  it("renders only question, date and one result link per reading; missing questions stay untitled", async () => {
    mocks.history.mockResolvedValue([{ id: "first", question: "Should I change jobs?", createdAt: new Date("2026-10-28"), primaryName: "Qian", hasReading: true }, { id: "second", question: null, createdAt: new Date("2026-10-27"), primaryName: "Kun" }]);
    const html = renderToStaticMarkup(await MyReadingsPage({}));
    expect(html).toContain("Should I change jobs?"); expect(html).toContain("Untitled Reading"); expect(html).toContain("Oct 28, 2026"); expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).toContain("/readings/result?session=first"); expect(html).not.toMatch(/Qian|Kun|Preview|Get Deep Reading|View Deep Reading|Changing Lines/);
  });
  it("uses Chinese routes without adding an empty-state CTA", async () => {
    mocks.history.mockResolvedValue([]);
    const html = renderToStaticMarkup(await MyReadingsPage({ zh: true }));
    expect(html).toContain("我的解读"); expect(html).not.toContain("<a ");
  });
  it("requires the user's session before reading history", async () => {
    mocks.user.mockResolvedValue(null); mocks.history.mockClear();
    await expect(MyReadingsPage({})).rejects.toThrow("NEXT_REDIRECT:/signin?callbackURL=%2Fmy-readings"); expect(mocks.history).not.toHaveBeenCalled();
  });
});
