import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkSystemReadiness: vi.fn(),
}));

vi.mock("@/server/readiness/readiness-service", () => ({
  checkSystemReadiness: () => mocks.checkSystemReadiness(),
}));

import { GET } from "./route";

describe("Ready Route (/api/ready)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 when system is ready", async () => {
    mocks.checkSystemReadiness.mockResolvedValue({
      status: "ready",
      overall: "ready",
      database: { status: "ok", connected: true, tablesChecked: true },
      capabilities: {
        auth: {
          requested: true,
          enabled: true,
          status: "enabled",
          missingDependencies: [],
          invalidDependencies: [],
          blockedDependencies: [],
        },
      },
    });

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const json = await response.json();
    expect(json.status).toBe("ready");
    expect(json.overall).toBe("ready");
  });

  it("returns 503 when system is blocked / not ready", async () => {
    mocks.checkSystemReadiness.mockResolvedValue({
      status: "not_ready",
      overall: "blocked",
      database: { status: "error", connected: false, tablesChecked: false },
      capabilities: {
        auth: {
          requested: true,
          enabled: false,
          status: "missing_dependencies",
          missingDependencies: ["DATABASE_URL"],
          invalidDependencies: [],
          blockedDependencies: [],
        },
      },
    });

    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const json = await response.json();
    expect(json.status).toBe("not_ready");
    expect(json.overall).toBe("blocked");
  });

  it("returns 503 when readiness check throws an unexpected error", async () => {
    mocks.checkSystemReadiness.mockRejectedValue(new Error("Database crash"));

    const response = await GET();
    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json.status).toBe("not_ready");
    expect(json.overall).toBe("blocked");
    expect(json.error).toBe("INTERNAL_READINESS_CHECK_FAILED");
    expect(JSON.stringify(json)).not.toContain("Database crash");
  });
});
