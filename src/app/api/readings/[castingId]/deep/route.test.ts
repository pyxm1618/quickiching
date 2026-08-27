import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  capabilityEnabled: true,
  sessionUser: { id: "user-1", email: "user1@example.com" } as { id: string; email: string } | null,
  requestDeepReading: vi.fn(),
  getDeepReadingStatus: vi.fn(),
}));

vi.mock("@/server/generation/deep-reading-capability", () => ({ isPaidDeepReadingCapabilityEnabled: () => mocks.capabilityEnabled }));
vi.mock("@/server/generation/deep-reading-composition", () => ({
  createProductionDeepReadingService: async () => ({ requestDeepReading: mocks.requestDeepReading, getDeepReadingStatus: mocks.getDeepReadingStatus }),
}));
vi.mock("@/lib/auth/session", () => ({ resolveSession: async () => (mocks.sessionUser ? { user: mocks.sessionUser } : null) }));

import { GET, POST } from "./route";

function postRequest(castingId: string, extraHeaders: Record<string, string> = {}) {
  return new Request(`https://www.quickiching.com/api/readings/${castingId}/deep`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://www.quickiching.com",
      referer: "https://www.quickiching.com/account",
      "sec-fetch-site": "same-origin",
      ...extraHeaders,
    },
  });
}

function getRequest(castingId: string) {
  return new Request(`https://www.quickiching.com/api/readings/${castingId}/deep`, { method: "GET" });
}

describe("Paid Deep Reading Route (/api/readings/[castingId]/deep)", () => {
  const castingId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    mocks.capabilityEnabled = true;
    mocks.sessionUser = { id: "user-1", email: "user1@example.com" };
    mocks.requestDeepReading.mockReset().mockResolvedValue({ jobId: "job-1", reservationId: "res-1", status: "queued" });
    mocks.getDeepReadingStatus.mockReset().mockResolvedValue({ status: "queued" });
  });

  it("returns 404 when capability is disabled", async () => {
    mocks.capabilityEnabled = false;
    expect((await POST(postRequest(castingId), { params: Promise.resolve({ castingId }) })).status).toBe(404);
    expect((await GET(getRequest(castingId), { params: Promise.resolve({ castingId }) })).status).toBe(404);
  });

  it("rejects cross-site requests with 403 Forbidden", async () => {
    const res = await POST(postRequest(castingId, {
      "sec-fetch-site": "cross-site", origin: "https://attacker.com", referer: "https://attacker.com/x",
    }), { params: Promise.resolve({ castingId }) });
    expect(res.status).toBe(403);
  });

  it.each(["origin", "referer", "sec-fetch-site"])("requires %s CSRF evidence", async (missing) => {
    const headers: Record<string, string> = {
      origin: "https://www.quickiching.com",
      referer: "https://www.quickiching.com/account",
      "sec-fetch-site": "same-origin",
    };
    delete headers[missing];
    const req = new Request(`https://www.quickiching.com/api/readings/${castingId}/deep`, { method: "POST", headers });
    expect((await POST(req, { params: Promise.resolve({ castingId }) })).status).toBe(403);
  });

  it("returns 401 when user is not signed in", async () => {
    mocks.sessionUser = null;
    expect((await POST(postRequest(castingId), { params: Promise.resolve({ castingId }) })).status).toBe(401);
    expect((await GET(getRequest(castingId), { params: Promise.resolve({ castingId }) })).status).toBe(401);
  });

  it("returns 404 for cross-user or soft-deleted requests (NEG-09, NEG-10)", async () => {
    mocks.requestDeepReading.mockRejectedValue(new Error("CASTING_NOT_FOUND"));
    expect((await POST(postRequest(castingId), { params: Promise.resolve({ castingId }) })).status).toBe(404);
    mocks.getDeepReadingStatus.mockRejectedValue(new Error("USER_NOT_FOUND_OR_DELETED"));
    expect((await GET(getRequest(castingId), { params: Promise.resolve({ castingId }) })).status).toBe(404);
  });

  it("returns 402 Insufficient Credits when user has 0 credits", async () => {
    mocks.requestDeepReading.mockRejectedValue(new Error("INSUFFICIENT_CREDITS"));
    const res = await POST(postRequest(castingId), { params: Promise.resolve({ castingId }) });
    expect(res.status).toBe(402);
  });

  it("surfaces encrypted-question failures without reserving/retrying", async () => {
    mocks.requestDeepReading.mockRejectedValue(new Error("QUESTION_KEY_UNAVAILABLE"));
    const res = await POST(postRequest(castingId), { params: Promise.resolve({ castingId }) });
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({ error: "QUESTION_KEY_UNAVAILABLE", retryable: false });
  });

  it("successfully initiates deep reading request with no-store headers", async () => {
    const res = await POST(postRequest(castingId), { params: Promise.resolve({ castingId }) });
    expect(res.status).toBe(202);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    await expect(res.json()).resolves.toEqual({ status: "queued", jobId: "job-1", reservationId: "res-1" });
  });

  it("successfully returns deep reading status and completed output", async () => {
    mocks.getDeepReadingStatus.mockResolvedValue({ status: "completed", output: { summary: "Deep guidance" } });
    const res = await GET(getRequest(castingId), { params: Promise.resolve({ castingId }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({ status: "completed", output: { summary: "Deep guidance" } });
  });
});
