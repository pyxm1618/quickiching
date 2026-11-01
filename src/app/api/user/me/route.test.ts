import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  loadAccountModal: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/server/account/modal-loader", () => ({ loadAccountModal: mocks.loadAccountModal }));

describe("GET /api/user/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user id and email when authenticated", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-123", email: "user@example.com" });
    const response = await GET(new Request("https://www.quickiching.com/api/user/me"));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      user: { id: "user-123", email: "user@example.com" },
    });
    expect(mocks.loadAccountModal).not.toHaveBeenCalled();
  });

  it("returns user null when unauthenticated", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await GET(new Request("https://www.quickiching.com/api/user/me"));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ user: null });
  });

  it("returns user null gracefully when getCurrentUser throws", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("AUTH_DISABLED"));
    const response = await GET(new Request("https://www.quickiching.com/api/user/me"));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ user: null });
  });
});

describe("on-demand Account view", () => {
  it("requires a session for private Account data", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await GET(new Request("https://www.quickiching.com/api/user/me?view=account"));
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("fails explicitly if session infrastructure fails", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("AUTH_UNAVAILABLE"));
    const response = await GET(new Request("https://www.quickiching.com/api/user/me?view=account"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "ACCOUNT_UNAVAILABLE" });
  });
});

it("scopes on-demand Account data to session identity, ignoring caller-supplied user IDs", async () => {
  mocks.getCurrentUser.mockResolvedValue({ id: "owner", email: "owner@example.com" });
  mocks.loadAccountModal.mockResolvedValue({ email: "owner@example.com", purchases: [], signInMethods: ["Google"], balance: { available: 2, expiringSoon: 0 } });
  const response = await GET(new Request("https://www.quickiching.com/api/user/me?view=account&userId=other"));
  expect(response.status).toBe(200);
  expect(mocks.loadAccountModal).toHaveBeenCalledWith({ id: "owner", email: "owner@example.com" });
  expect((await response.json()).email).toBe("owner@example.com");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
