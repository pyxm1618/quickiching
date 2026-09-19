import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

import { GET } from "./route";

describe("GET /api/auth/me", () => {
  it("returns null when user is not authenticated", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ user: null });
  });

  it("returns user id and email when authenticated", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: "usr_123", email: "user@example.com" });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ user: { id: "usr_123", email: "user@example.com" } });
  });

  it("handles auth unavailability gracefully", async () => {
    mocks.getCurrentUser.mockRejectedValueOnce(new Error("Auth unavailable"));
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ user: null });
  });
});
