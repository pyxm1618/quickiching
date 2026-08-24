import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewGenerationError } from "@/server/generation/preview-service";

const mocks = vi.hoisted(() => ({
  capabilityEnabled: true,
  getAuth: vi.fn(),
  createService: vi.fn(),
  session: { user: { id: "user-1", email: "user@example.com" } } as { user: { id: string; email: string } } | null,
  service: {
    generate: vi.fn(),
    getStatus: vi.fn(),
  },
}));

vi.mock("@/server/generation/capability", () => ({
  isAiPreviewCapabilityEnabled: () => mocks.capabilityEnabled,
}));

vi.mock("@/server/auth/server", () => ({
  getAuth: mocks.getAuth,
}));

vi.mock("@/server/generation/composition", () => ({
  createProductionPreviewGenerationService: mocks.createService,
}));

import { GET, POST } from "./route";

const CASTING_ID = "00000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ castingId: CASTING_ID }) };

function request(path = `/api/readings/${CASTING_ID}/preview`, init: RequestInit = {}) {
  return new Request(`https://www.quickiching.com${path}`, init);
}

describe("Commercial V2 Preview route", () => {
  beforeEach(() => {
    mocks.capabilityEnabled = true;
    mocks.session = { user: { id: "user-1", email: "user@example.com" } };
    mocks.service.generate.mockReset();
    mocks.service.getStatus.mockReset();
    mocks.createService.mockReset();
    mocks.getAuth.mockReset();
    mocks.getAuth.mockReturnValue({
      api: { getSession: vi.fn().mockResolvedValue(mocks.session) },
    });
    mocks.createService.mockResolvedValue(mocks.service);
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns a capability-off 404 without initializing auth or the provider", async () => {
    mocks.capabilityEnabled = false;

    const response = await POST(request(`/api/readings/${CASTING_ID}/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: "request-1" }),
    }), context);

    expect(response.status).toBe(404);
    expect(mocks.getAuth).not.toHaveBeenCalled();
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("rejects cross-site JSON requests before session or generation work", async () => {
    const response = await POST(request(`/api/readings/${CASTING_ID}/preview`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify({ idempotencyKey: "request-1" }),
    }), context);

    expect(response.status).toBe(403);
    expect(mocks.getAuth).not.toHaveBeenCalled();
  });

  it("accepts only a bounded idempotency key and never accepts question text", async () => {
    const response = await POST(request(`/api/readings/${CASTING_ID}/preview`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://www.quickiching.com" },
      body: JSON.stringify({ idempotencyKey: "request-1", question: "private question" }),
    }), context);

    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("private question");
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("requires a Better Auth session and does not fall back to an in-memory owner", async () => {
    mocks.session = null;
    mocks.getAuth.mockReturnValue({ api: { getSession: vi.fn().mockResolvedValue(null) } });

    const response = await POST(request(`/api/readings/${CASTING_ID}/preview`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://www.quickiching.com" },
      body: JSON.stringify({ idempotencyKey: "request-1" }),
    }), context);

    expect(response.status).toBe(401);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("passes only the authenticated user, casting id, idempotency key, and abort signal to the service", async () => {
    mocks.service.generate.mockResolvedValue({ status: "completed", jobId: "job-1", result: {
      castingId: CASTING_ID,
      jobId: "job-1",
      output: {
        schemaVersion: "commercial-preview-v1",
        relevanceStatement: "A bounded reflection.",
        surfaceThemes: ["Timing"],
        boundary: "This is not a complete reading.",
        disclaimer: "For reflection only.",
      },
      schemaVersion: "commercial-preview-v1",
      promptVersion: "commercial-preview-prompt-v1",
      provider: "test",
      model: "test-model",
      integrityHash: "hash",
      persistedAt: new Date("2026-08-23T00:00:00.000Z"),
    } });

    const response = await POST(request(`/api/readings/${CASTING_ID}/preview`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://www.quickiching.com" },
      body: JSON.stringify({ idempotencyKey: "request-1" }),
    }), context);

    expect(response.status).toBe(200);
    expect(mocks.service.generate).toHaveBeenCalledWith(expect.objectContaining({
      castingId: CASTING_ID,
      userId: "user-1",
      idempotencyKey: "request-1",
      signal: expect.any(AbortSignal),
    }));
    const text = await response.text();
    expect(text).not.toContain("question");
  });

  it("maps service failures to safe, non-provider error responses", async () => {
    mocks.service.generate.mockRejectedValue(new Error("provider secret and private question"));

    const response = await POST(request(`/api/readings/${CASTING_ID}/preview`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://www.quickiching.com" },
      body: JSON.stringify({ idempotencyKey: "request-1" }),
    }), context);

    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain("provider secret");
    expect(text).not.toContain("private question");
  });

  it.each([
    [new PreviewGenerationError("AI_GATEWAY_TIMEOUT", true), 504, "AI_GATEWAY_TIMEOUT"],
    [new PreviewGenerationError("rate_limit", true), 429, "rate_limit"],
    [new PreviewGenerationError("PREVIEW_RETRY_BUDGET_EXCEEDED", true), 429, "PREVIEW_RETRY_BUDGET_EXCEEDED"],
    [new PreviewGenerationError("GENERATION_IDEMPOTENCY_CONFLICT"), 409, "GENERATION_IDEMPOTENCY_CONFLICT"],
    [new PreviewGenerationError("AI_SCHEMA_INVALID"), 502, "AI_SCHEMA_INVALID"],
    [new PreviewGenerationError("schema_error"), 502, "schema_error"],
    [new PreviewGenerationError("safety_failure"), 502, "safety_failure"],
    [new PreviewGenerationError("cost_limit"), 502, "cost_limit"],
  ])("maps %s to the bounded HTTP state", async (error, expectedStatus, expectedCode) => {
    mocks.service.generate.mockRejectedValue(error);

    const response = await POST(request(`/api/readings/${CASTING_ID}/preview`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://www.quickiching.com" },
      body: JSON.stringify({ idempotencyKey: "request-1" }),
    }), context);

    expect(response.status).toBe(expectedStatus);
    await expect(response.json()).resolves.toEqual({ error: expectedCode, retryable: error.retryable });
  });

  it("serves status through the same exact authenticated path without accepting a question", async () => {
    mocks.service.getStatus.mockResolvedValue({ status: "not_started", jobId: null });

    const response = await GET(request(), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "not_started", jobId: null });
    expect(mocks.service.getStatus).toHaveBeenCalledWith({ castingId: CASTING_ID, userId: "user-1" });
  });
});
