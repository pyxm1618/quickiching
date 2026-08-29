import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAnonymousHash: vi.fn(),
  getPostgresClient: vi.fn(),
  listCastsForUser: vi.fn(),
  getBatches: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
  getAnonymousHash: mocks.getAnonymousHash,
}));

vi.mock("@/server/db/client", () => ({
  getPostgresClient: mocks.getPostgresClient,
}));

vi.mock("@/server/repository", () => ({
  repo: {
    listCastsForUser: mocks.listCastsForUser,
    getBatches: mocks.getBatches,
  },
}));

import { loadEntitlementBalance, loadHistory } from "./loaders";

describe("commercial account loaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DATABASE_ADAPTER_MODE", "postgres");
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@db.example.com/quickiching");
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when PostgreSQL history query fails instead of returning memory history", async () => {
    const databaseError = new Error("DB_CONNECTION_LOST");
    mocks.getPostgresClient.mockReturnValue(vi.fn(() => Promise.reject(databaseError)));
    mocks.listCastsForUser.mockReturnValue([]);

    await expect(loadHistory()).rejects.toThrow("DB_CONNECTION_LOST");
    expect(mocks.listCastsForUser).not.toHaveBeenCalled();
  });

  it("fails closed when PostgreSQL entitlement query fails instead of returning a synthetic zero balance", async () => {
    const databaseError = new Error("DB_CONNECTION_LOST");
    mocks.getPostgresClient.mockReturnValue(vi.fn(() => Promise.reject(databaseError)));
    mocks.getBatches.mockReturnValue([]);

    await expect(loadEntitlementBalance()).rejects.toThrow("DB_CONNECTION_LOST");
    expect(mocks.getBatches).not.toHaveBeenCalled();
  });

  it("retains the in-memory path when PostgreSQL mode is not configured", async () => {
    vi.stubEnv("DATABASE_ADAPTER_MODE", "memory");
    vi.stubEnv("DATABASE_URL", "");
    mocks.listCastsForUser.mockReturnValue([]);
    mocks.getBatches.mockReturnValue([]);

    await expect(loadHistory()).resolves.toEqual([]);
    await expect(loadEntitlementBalance()).resolves.toEqual({ available: 0, expiringSoon: 0 });
    expect(mocks.getPostgresClient).not.toHaveBeenCalled();
  });
});
