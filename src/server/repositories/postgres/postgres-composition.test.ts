import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("production repository composition", () => {
  it("refuses to load the synchronous memory facade in PostgreSQL mode", async () => {
    vi.stubEnv("DATABASE_ADAPTER_MODE", "postgres");

    await expect(import("@/server/repository")).rejects.toThrow(
      "POSTGRES_REQUIRES_ASYNC_APPLICATION_COMPOSITION",
    );
  });

  it("retains the explicit memory facade only in local memory mode", async () => {
    vi.stubEnv("DATABASE_ADAPTER_MODE", "memory");

    await expect(import("@/server/repository")).resolves.toHaveProperty("repo");
  });
});
