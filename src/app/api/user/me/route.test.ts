import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

describe("GET /api/user/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user id and email when authenticated", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-123", email: "user@example.com" });
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      user: { id: "user-123", email: "user@example.com" },
    });
  });

  it("returns user null when unauthenticated", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ user: null });
  });

  it("returns user null gracefully when getCurrentUser throws", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("AUTH_DISABLED"));
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ user: null });
  });
});
