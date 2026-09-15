import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enabled: true,
  sameOrigin: true,
  userId: "user-1" as string | null,
  deleteAccount: vi.fn(),
}));

vi.mock("@/server/auth/capability", () => ({ isAuthCapabilityEnabled: () => mocks.enabled }));
vi.mock("@/server/http/origin-guard", () => ({ isStrictSameOriginRequest: () => mocks.sameOrigin }));
vi.mock("@/lib/auth/session", () => ({ resolveSession: async () => mocks.userId ? { user: { id: mocks.userId } } : null }));
vi.mock("@/server/db/client", () => ({ getCommercialDatabaseConnection: () => ({ client: {} }) }));
vi.mock("@/server/account/postgres-repository", () => ({
  createPostgresAccountRepository: () => ({ deleteAccount: mocks.deleteAccount }),
}));

import { GET, POST } from "./route";

function request() {
  return new Request("https://www.quickiching.com/api/account/delete", {
    method: "POST",
    headers: {
      origin: "https://www.quickiching.com",
      referer: "https://www.quickiching.com/account",
      "sec-fetch-site": "same-origin",
    },
  });
}

describe("account deletion route", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://example.invalid/db");
    mocks.enabled = true;
    mocks.sameOrigin = true;
    mocks.userId = "user-1";
    mocks.deleteAccount.mockReset().mockResolvedValue({ success: true });
  });

  it("fails closed when auth capability is off", async () => {
    mocks.enabled = false;
    expect((await POST(request())).status).toBe(404);
  });

  it("rejects a CSRF-invalid request before deletion", async () => {
    mocks.sameOrigin = false;
    expect((await POST(request())).status).toBe(403);
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
  });

  it("requires an authenticated user", async () => {
    mocks.userId = null;
    expect((await POST(request())).status).toBe(401);
  });

  it("deletes only the authenticated account", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.deleteAccount).toHaveBeenCalledWith("user-1");
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it("does not expose GET deletion", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });
});
