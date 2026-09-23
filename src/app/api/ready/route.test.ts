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

  it("returns only coarse public readiness state when system is ready", async () => {
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
    expect(json).toEqual({ status: "ready", overall: "ready" });
    expect(json.database).toBeUndefined();
    expect(json.capabilities).toBeUndefined();
  });

  it("returns only coarse public readiness state when system is blocked", async () => {
    mocks.checkSystemReadiness.mockResolvedValue({
      status: "not_ready",
      overall: "blocked",
      database: {
        status: "tables_missing",
        connected: true,
        tablesChecked: true,
        missingTables: ["audit_events"],
      },
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
    expect(json).toEqual({ status: "not_ready", overall: "blocked" });
    expect(JSON.stringify(json)).not.toContain("audit_events");
    expect(JSON.stringify(json)).not.toContain("DATABASE_URL");
  });

  it("returns a coarse 503 when readiness check throws an unexpected error", async () => {
    mocks.checkSystemReadiness.mockRejectedValue(new Error("Database crash"));

    const response = await GET();
    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json).toEqual({ status: "not_ready", overall: "blocked" });
    expect(JSON.stringify(json)).not.toContain("Database crash");
  });
});
