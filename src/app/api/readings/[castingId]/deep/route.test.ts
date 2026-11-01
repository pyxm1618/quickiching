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

function completedReport() {
  return {
    schemaVersion: "deep-reading-v3" as const,
    readingVariant: "standard" as const,
    directAnswer: "A clear next step depends on what is confirmed in the current situation and which option remains reversible.",
    whyThisReading: "This reading points to a focused transition because the active pattern emphasizes deliberate movement and observable evidence.",
    whatMattersMost: ["Keep the next move reversible while you gather concrete evidence from the situation."],
    whatToDoNext: ["Choose one small action that tests the direction and review the result before committing further."],
    uncertaintyAndBoundaries: "The reading cannot establish another person’s future choice, so observable follow-through remains the boundary.",
    interpretiveBasisReferences: [{ evidenceId: "primary.judgment" }],
    disclaimer: "Use this reading as reflective guidance rather than a certain prediction or professional advice.",
  };
}

function historicalV2Report() {
  return {
    schemaVersion: "deep-reading-v2" as const,
    readingVariant: "standard" as const,
    directAnswer: "A clear next step depends on what is confirmed in the current situation and which option remains reversible.",
    situationMapping: "The cast describes an active transition, while the supplied context determines which part of that pattern applies now.",
    keyTensions: ["Move with purpose while keeping the decision open to new evidence."],
    conditionalDirection: "If the relevant support is present, a measured next step can test the direction without committing to the full outcome.",
    signalsToWatch: ["Watch whether the other party follows through on the specific commitment."],
    practicalReflection: "Write down what would count as reliable evidence, then choose one action that can be reviewed soon.",
    uncertaintyAndBoundaries: "The cast cannot establish what another person will decide; that remains unknown until observable actions occur.",
    interpretiveBasisReferences: [{ evidenceId: "primary:judgment" }],
    disclaimer: "This is conditional reflection and not a certain prediction.",
  };
}

function historicalV1Report() {
  return {
    schemaVersion: "commercial-reading-v1" as const,
    readingVariant: "standard" as const,
    coreSummary: "The situation calls for a measured response that protects room to adjust as new information becomes available.",
    currentStage: "You are at a decision point where preparation matters more than speed.",
    primaryHexagramPattern: "The primary pattern emphasizes sustained effort and disciplined timing.",
    changeMechanism: "Change develops through a narrow opening rather than a sudden reversal.",
    possibleDirection: "Progress is possible when support becomes visible and repeatable.",
    obstaclesAndBlindSpots: "The main risk is treating an early signal as if it were a durable commitment.",
    turningConditions: "Act when the relevant support is concrete enough to verify in practice.",
    conditionalActionDirection: "Take one reversible step, then reassess before increasing commitment.",
    uncertaintyAndBoundaries: "The reading cannot guarantee an external outcome or another person’s decision.",
    interpretiveBasisReferences: [],
    disclaimer: "Use this for reflection rather than certainty or professional advice.",
  };
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

  it("returns a normalized completed presentation without exposing raw report or snapshot", async () => {
    const output = completedReport();
    mocks.requestDeepReading.mockResolvedValue({
      status: "completed",
      jobId: "job-completed",
      reservationId: "reservation-completed",
      output,
    });
    const response = await POST(postRequest(castingId), { params: Promise.resolve({ castingId }) });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      status: "completed",
      viewModel: {
        schemaVersion: "ai-deep-reading-view-v1",
      },
    });
    expect(payload.viewModel.coreLead).toContain("clear next step");
    expect(payload).not.toHaveProperty("output");
    expect(payload).not.toHaveProperty("snapshot");
  });

  it("successfully initiates deep reading request with no-store headers", async () => {
    const res = await POST(postRequest(castingId), { params: Promise.resolve({ castingId }) });
    expect(res.status).toBe(202);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    await expect(res.json()).resolves.toEqual({ status: "queued", jobId: "job-1", reservationId: "res-1" });
  });

  it("successfully returns deep reading status and completed output", async () => {
    mocks.getDeepReadingStatus.mockResolvedValue({ status: "completed", output: completedReport() });
    const res = await GET(getRequest(castingId), { params: Promise.resolve({ castingId }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const payload = await res.json();
    expect(payload.status).toBe("completed");
    expect(payload.viewModel.schemaVersion).toBe("ai-deep-reading-view-v1");
    expect(payload).not.toHaveProperty("output");
    expect(payload).not.toHaveProperty("snapshot");
  });

  it.each([
    ["v2", historicalV2Report()],
    ["v1", historicalV1Report()],
  ])("normalizes historical %s reports at the API boundary", async (_version, output) => {
    mocks.getDeepReadingStatus.mockResolvedValue({ status: "completed", output });
    const res = await GET(getRequest(castingId), { params: Promise.resolve({ castingId }) });
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.status).toBe("completed");
    expect(payload.viewModel.schemaVersion).toBe("ai-deep-reading-view-v1");
    expect(payload.viewModel.coreLead).toBeTruthy();
    expect(payload).not.toHaveProperty("output");
    expect(payload).not.toHaveProperty("snapshot");
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
