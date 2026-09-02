import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enabled: true,
  resolveSession: vi.fn(),
  createRepository: vi.fn(),
  persistAttestedCast: vi.fn(),
  session: { user: { id: "user-1", email: "reader@example.com" } } as {
    user: { id: string; email: string };
  } | null,
}));

vi.mock("@/server/generation/deep-reading-capability", () => ({
  isPaidDeepReadingCapabilityEnabled: () => mocks.enabled,
}));
vi.mock("@/lib/auth/session", () => ({ resolveSession: mocks.resolveSession }));
vi.mock("@/server/casting/composition", () => ({
  createProductionCastingRepository: mocks.createRepository,
}));

import { GET, POST } from "./route";

// Six young lines (all 8 = young yin) is hexagram 2, K'un, with no moving lines.
const KUN = [8, 8, 8, 8, 8, 8];
const QUESTION = "Should I take the role I was offered in another city?";

function body(overrides: Record<string, unknown> = {}) {
  return {
    lineValuesBottomUp: KUN,
    method: "three_coin",
    question: QUESTION,
    scene: "career",
    interpretationGoal: "what_do_i_need_to_see_clearly",
    ...overrides,
  };
}

function request(payload: unknown, headers: Record<string, string> = {}) {
  return new Request("https://www.quickiching.com/api/readings/claim", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://www.quickiching.com",
      referer: "https://www.quickiching.com/history",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}

describe("claim route gating", () => {
  beforeEach(() => {
    vi.stubEnv("APP_BASE_URL", "https://www.quickiching.com");
    vi.stubEnv("BETTER_AUTH_URL", "https://www.quickiching.com");
    mocks.enabled = true;
    mocks.session = { user: { id: "user-1", email: "reader@example.com" } };
    mocks.resolveSession.mockReset().mockImplementation(async () => mocks.session);
    mocks.persistAttestedCast.mockReset().mockResolvedValue({
      castingId: "0f1d2f1e-9a3b-4c1d-8e2f-5a6b7c8d9e0f",
      reused: false,
    });
    mocks.createRepository.mockReset().mockResolvedValue({
      persistAttestedCast: mocks.persistAttestedCast,
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("returns 404 before auth or persistence when the capability is closed", async () => {
    mocks.enabled = false;

    const response = await POST(request(body()));

    expect(response.status).toBe(404);
    expect(mocks.resolveSession).not.toHaveBeenCalled();
    expect(mocks.createRepository).not.toHaveBeenCalled();
  });

  it("rejects cross-site requests before auth and persistence", async () => {
    const response = await POST(request(body(), {
      origin: "https://attacker.example",
      referer: "https://attacker.example/x",
      "sec-fetch-site": "cross-site",
    }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "CSRF_REJECTED" });
    expect(mocks.resolveSession).not.toHaveBeenCalled();
    expect(mocks.persistAttestedCast).not.toHaveBeenCalled();
  });

  it.each(["origin", "referer", "sec-fetch-site"])("requires %s CSRF evidence", async (header) => {
    const csrfHeaders: Record<string, string> = {
      origin: "https://www.quickiching.com",
      referer: "https://www.quickiching.com/history",
      "sec-fetch-site": "same-origin",
    };
    delete csrfHeaders[header];

    const response = await POST(new Request("https://www.quickiching.com/api/readings/claim", {
      method: "POST",
      headers: { "content-type": "application/json", ...csrfHeaders },
      body: JSON.stringify(body()),
    }));

    expect(response.status).toBe(403);
    expect(mocks.resolveSession).not.toHaveBeenCalled();
  });

  it("requires a signed-in reader", async () => {
    mocks.session = null;

    const response = await POST(request(body()));

    expect(response.status).toBe(401);
    expect(mocks.persistAttestedCast).not.toHaveBeenCalled();
  });

  it("reports auth outage as 503 rather than treating it as signed out", async () => {
    mocks.resolveSession.mockRejectedValue(new Error("AUTH_BACKEND_DOWN"));

    const response = await POST(request(body()));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "AUTH_UNAVAILABLE" });
  });

  it("rejects a body over the byte ceiling", async () => {
    const response = await POST(request(body({ question: "a".repeat(9 * 1024) })));

    expect([400, 413]).toContain(response.status);
    expect(mocks.persistAttestedCast).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON content type", async () => {
    const response = await POST(request(body(), { "content-type": "text/plain" }));

    expect(response.status).toBe(400);
  });

  it("does not answer GET", async () => {
    expect((await GET()).status).toBe(405);
  });
});

describe("claim route rejects a forged cast", () => {
  beforeEach(() => {
    vi.stubEnv("APP_BASE_URL", "https://www.quickiching.com");
    vi.stubEnv("BETTER_AUTH_URL", "https://www.quickiching.com");
    mocks.enabled = true;
    mocks.session = { user: { id: "user-1", email: "reader@example.com" } };
    mocks.resolveSession.mockReset().mockImplementation(async () => mocks.session);
    mocks.persistAttestedCast.mockReset().mockResolvedValue({
      castingId: "0f1d2f1e-9a3b-4c1d-8e2f-5a6b7c8d9e0f",
      reused: false,
    });
    mocks.createRepository.mockReset().mockResolvedValue({
      persistAttestedCast: mocks.persistAttestedCast,
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["primaryHexagramNumber", { primaryHexagramNumber: 1 }],
    ["relatingHexagramNumber", { relatingHexagramNumber: 64 }],
    ["movingLinePositions", { movingLinePositions: [1, 2, 3] }],
    ["algorithmVersion", { algorithmVersion: "attacker-v9" }],
    ["castOrigin", { castOrigin: "server_generated" }],
    ["userId", { userId: "someone-else" }],
    ["riskStatus", { riskStatus: "allowed" }],
  ])("refuses a body that also supplies %s", async (_label, extra) => {
    const response = await POST(request(body(extra)));

    expect(response.status).toBe(400);
    expect(mocks.persistAttestedCast).not.toHaveBeenCalled();
  });

  it.each([
    ["five line values", [8, 8, 8, 8, 8]],
    ["seven line values", [8, 8, 8, 8, 8, 8, 8]],
    ["a value outside 6..9", [8, 8, 8, 8, 8, 5]],
    ["a non-integer value", [8, 8, 8, 8, 8, 7.5]],
    ["a string value", [8, 8, 8, 8, 8, "9"]],
  ])("refuses %s", async (_label, lineValuesBottomUp) => {
    const response = await POST(request(body({ lineValuesBottomUp })));

    expect(response.status).toBe(400);
    expect(mocks.persistAttestedCast).not.toHaveBeenCalled();
  });

  it.each(["method", "scene", "interpretationGoal"])("refuses an unknown %s", async (field) => {
    const response = await POST(request(body({ [field]: "not-a-real-value" })));

    expect(response.status).toBe(400);
    expect(mocks.persistAttestedCast).not.toHaveBeenCalled();
  });

  it("recomputes the hexagram from the line values instead of trusting the caller", async () => {
    // 9,8,8,8,8,8: a moving yang in line 1 over yin. Primary 24 (Return),
    // relating 2 (K'un) once the moving line settles.
    await POST(request(body({ lineValuesBottomUp: [9, 8, 8, 8, 8, 8] })));

    expect(mocks.persistAttestedCast).toHaveBeenCalledTimes(1);
    const { facts } = mocks.persistAttestedCast.mock.calls[0]![0] as {
      facts: {
        primaryHexagramNumber: number;
        movingLinePositions: number[];
        relatingHexagramNumber: number | null;
      };
    };
    expect(facts.primaryHexagramNumber).toBe(24);
    expect(facts.movingLinePositions).toEqual([1]);
    expect(facts.relatingHexagramNumber).toBe(2);
  });

  it("persists under the session user, never a caller-named one", async () => {
    await POST(request(body()));

    expect(mocks.persistAttestedCast).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
    );
  });
});

describe("claim route risk handling", () => {
  beforeEach(() => {
    vi.stubEnv("APP_BASE_URL", "https://www.quickiching.com");
    vi.stubEnv("BETTER_AUTH_URL", "https://www.quickiching.com");
    mocks.enabled = true;
    mocks.session = { user: { id: "user-1", email: "reader@example.com" } };
    mocks.resolveSession.mockReset().mockImplementation(async () => mocks.session);
    mocks.persistAttestedCast.mockReset().mockResolvedValue({
      castingId: "0f1d2f1e-9a3b-4c1d-8e2f-5a6b7c8d9e0f",
      reused: false,
    });
    mocks.createRepository.mockReset().mockResolvedValue({
      persistAttestedCast: mocks.persistAttestedCast,
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("returns 201 and the casting id for an allowed question", async () => {
    const response = await POST(request(body()));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ castingId: "0f1d2f1e-9a3b-4c1d-8e2f-5a6b7c8d9e0f" });
    expect(mocks.persistAttestedCast).toHaveBeenCalledWith(
      expect.objectContaining({ risk: expect.objectContaining({ status: "allowed" }) }),
    );
  });

  it("returns 200 when an identical claim is reused", async () => {
    mocks.persistAttestedCast.mockResolvedValue({
      castingId: "0f1d2f1e-9a3b-4c1d-8e2f-5a6b7c8d9e0f",
      reused: true,
    });

    const response = await POST(request(body()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ castingId: "0f1d2f1e-9a3b-4c1d-8e2f-5a6b7c8d9e0f" });
  });

  it("blocks a professional decision question with 403 and records the true status", async () => {
    const response = await POST(request(body({
      question: "Should I stop taking the medication my doctor prescribed for me?",
      scene: "other",
    })));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "RISK_PROHIBITED",
      riskStatus: "professional_decision_blocked",
    });
    expect(mocks.persistAttestedCast).toHaveBeenCalledWith(
      expect.objectContaining({
        risk: expect.objectContaining({ status: "professional_decision_blocked" }),
      }),
    );
  });

  it("blocks an emergency question with 403 and records the true status", async () => {
    const response = await POST(request(body({
      question: "I keep thinking I want to kill myself, what does the hexagram say?",
      scene: "personal_growth",
    })));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "RISK_PROHIBITED",
      riskStatus: "emergency_blocked",
    });
    expect(mocks.persistAttestedCast).toHaveBeenCalledWith(
      expect.objectContaining({ risk: expect.objectContaining({ status: "emergency_blocked" }) }),
    );
  });

  it("never returns a casting id for a blocked question", async () => {
    const response = await POST(request(body({
      question: "Should I sell all my bitcoin holdings this week or hold them?",
      scene: "wealth",
    })));

    expect(response.status).toBe(403);
    expect(await response.json()).not.toHaveProperty("castingId");
  });

  it("reports a persistence outage as 503", async () => {
    mocks.persistAttestedCast.mockRejectedValue(new Error("connection refused"));

    const response = await POST(request(body()));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "CLAIM_UNAVAILABLE" });
  });

  it("reports a composition outage as 503", async () => {
    mocks.createRepository.mockRejectedValue(new Error("PAID_DEEP_READING_DISABLED"));

    const response = await POST(request(body()));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "CLAIM_UNAVAILABLE" });
  });
});
