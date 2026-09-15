import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reconcileEnabled: true,
  cronSecret: "test-cron-secret-32-chars-long-minimum!",
  runReconcile: vi.fn(),
}));

vi.mock("@/server/reconcile/capability", () => ({
  isReconcileCapabilityEnabled: () => mocks.reconcileEnabled,
}));

vi.mock("@/server/reconcile/composition", () => ({
  createProductionReconcileService: async () => ({
    runReconcile: mocks.runReconcile,
  }),
}));

vi.mock("@/server/config", () => ({
  getServerConfig: () => ({
    cronSecret: mocks.cronSecret,
  }),
}));

import { GET, POST, PUT, DELETE } from "./route";

describe("Internal Reconcile Cron Route (/api/internal/reconcile)", () => {
  beforeEach(() => {
    mocks.reconcileEnabled = true;
    mocks.cronSecret = "test-cron-secret-32-chars-long-minimum!";
    mocks.runReconcile.mockReset().mockResolvedValue({
      outboxProcessed: 2,
      checkoutCleaned: 1,
      jobsTimedOut: 0,
      reservationsReleased: 1,
      workflowRunsRecovered: 0,
      durationMs: 45,
    });
  });

  it("returns 404 when reconcile capability is disabled", async () => {
    mocks.reconcileEnabled = false;
    const req = new Request("https://www.quickiching.com/api/internal/reconcile", {
      method: "GET",
      headers: { authorization: `Bearer ${mocks.cronSecret}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns 401 when Authorization header is missing or incorrect", async () => {
    const missingReq = new Request("https://www.quickiching.com/api/internal/reconcile", {
      method: "GET",
    });
    expect((await GET(missingReq)).status).toBe(401);

    const wrongReq = new Request("https://www.quickiching.com/api/internal/reconcile", {
      method: "GET",
      headers: { authorization: "Bearer wrong-secret" },
    });
    expect((await GET(wrongReq)).status).toBe(401);
  });

  it("returns 401 when secret is supplied via query string (disallowed)", async () => {
    const queryReq = new Request(`https://www.quickiching.com/api/internal/reconcile?secret=${mocks.cronSecret}`, {
      method: "GET",
    });
    expect((await GET(queryReq)).status).toBe(401);
  });

  it("runs reconcile and returns bounded sanitised metrics with no-store headers", async () => {
    const req = new Request("https://www.quickiching.com/api/internal/reconcile", {
      method: "GET",
      headers: { authorization: `Bearer ${mocks.cronSecret}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");

    const body = await res.json();
    expect(body).toEqual({
      outboxProcessed: 2,
      checkoutCleaned: 1,
      jobsTimedOut: 0,
      reservationsReleased: 1,
      workflowRunsRecovered: 0,
      durationMs: 45,
    });
    // Ensure no sensitive info leaked
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(JSON.stringify(body)).not.toContain("email");
  });

  it("rejects non-GET HTTP methods with 405 Method Not Allowed", async () => {
    expect((await POST()).status).toBe(405);
    expect((await PUT()).status).toBe(405);
    expect((await DELETE()).status).toBe(405);
  });
});
