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
    body: JSON.stringify({ locale: "en" }),
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

  it("returns 413 for an oversized Deep Reading POST body", async () => {
    const request = new Request(`https://www.quickiching.com/api/readings/${castingId}/deep`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://www.quickiching.com",
        referer: "https://www.quickiching.com/account",
        "sec-fetch-site": "same-origin",
      },
      body: JSON.stringify({
        contextNotes: "x".repeat(17 * 1024),
        options: [],
        constraints: [],
        concerns: [],
        interpretationGoal: "what_do_i_need_to_see_clearly",
        locale: "en",
      }),
    });
    const response = await POST(request, { params: Promise.resolve({ castingId }) });
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "REQUEST_BODY_TOO_LARGE" });
    expect(mocks.requestDeepReading).not.toHaveBeenCalled();
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

  it("rejects retired enrichment before calling the reservation service", async () => {
    const req = new Request(`https://www.quickiching.com/api/readings/${castingId}/deep`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://www.quickiching.com",
        referer: "https://www.quickiching.com/account",
        "sec-fetch-site": "same-origin",
      },
      body: JSON.stringify({
        contextNotes: "",
        options: [],
        constraints: [],
        concerns: [],
        interpretationGoal: "what_do_i_need_to_see_clearly",
        locale: "en",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ castingId }) });
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({ error: "INVALID_DEEP_READING_REQUEST", retryable: false });
    expect(mocks.requestDeepReading).not.toHaveBeenCalled();
  });

  it("defaults an empty request body to English without enrichment", async () => {
    const original = postRequest(castingId);
    const request = new Request(original.url, { method: "POST", headers: original.headers });
    const response = await POST(request, { params: Promise.resolve({ castingId }) });
    expect(response.status).toBe(202);
    expect(mocks.requestDeepReading).toHaveBeenCalledWith({ userId: "user-1", castingId, locale: "en" });
  });

  it("surfaces encrypted-question failures without reserving/retrying", async () => {
    mocks.requestDeepReading.mockRejectedValue(new Error("QUESTION_KEY_UNAVAILABLE"));
    const res = await POST(postRequest(castingId), { params: Promise.resolve({ castingId }) });
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({ error: "QUESTION_KEY_UNAVAILABLE", retryable: false });
  });

  it("returns the trusted snapshot when a completed request is replayed", async () => {
    const snapshot = {
      schemaVersion: "deep-reading-context-v1",
      coreQuestionAtCast: "What should I focus on?",
      context: {
        contextNotes: "The team changed its timeline and I need a clear next step.",
        options: [],
        constraints: [],
        concerns: [],
        interpretationGoal: "what_do_i_need_to_see_clearly",
        locale: "en",
      },
      scene: "career",
      castMethod: "three_coin",
      methodVersion: "three-coin-v1",
      facts: {
        method: "three_coin",
        algorithmVersion: "three-coin-v1",
        classicMappingVersion: "king-wen-v1",
        lineValuesBottomUp: [7, 8, 7, 8, 7, 8],
        primaryHexagramNumber: 11,
        movingLinePositions: [],
        relatingHexagramNumber: null,
        readingVariant: "still_hexagram",
      },
      snapshotAt: "2026-10-23T00:00:00.000Z",
      knowledgeVersion: "test",
      risk: { status: "allowed", ruleVersion: "risk-v3", reasonCode: "allowed" },
      knowledge: { version: "test" },
    };
    mocks.requestDeepReading.mockResolvedValue({
      status: "completed",
      jobId: "job-completed",
      reservationId: "reservation-completed",
      output: { summary: "done" },
      snapshot,
    });
    const response = await POST(postRequest(castingId), { params: Promise.resolve({ castingId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "completed",
      snapshot,
    });
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

  it.each(["failed", "timed_out"] as const)("returns authoritative availableCredits for terminal %s status", async (status) => {
    mocks.getDeepReadingStatus.mockResolvedValue({
      status,
      errorCode: status === "timed_out" ? "GENERATION_TIMEOUT" : "WORKFLOW_START_FAILED",
      availableCredits: 2,
    });
    const res = await GET(getRequest(castingId), { params: Promise.resolve({ castingId }) });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status, availableCredits: 2 });
  });
});
