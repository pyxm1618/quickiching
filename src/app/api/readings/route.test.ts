import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessionUser: { id: "user-test-1", email: "user@example.com" } as { id: string; email: string } | null,
}));

vi.mock("@/lib/auth/session", () => ({
  resolveSession: async () => (mocks.sessionUser ? { user: mocks.sessionUser } : null),
}));

import { POST } from "./route";

function createReq(body: unknown, origin = "https://www.quickiching.com") {
  return new Request("https://www.quickiching.com/api/readings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin,
      referer: `${origin}/readings/three-coin/result`,
      "sec-fetch-site": origin === "https://www.quickiching.com" ? "same-origin" : "cross-site",
      host: "www.quickiching.com",
    },
    body: JSON.stringify(body),
  });
}

describe("Save Reading Route (POST /api/readings)", () => {
  beforeEach(() => {
    vi.stubEnv("APP_BASE_URL", "https://www.quickiching.com");
    vi.stubEnv("BETTER_AUTH_URL", "https://www.quickiching.com");
    vi.stubEnv("DATABASE_ADAPTER_MODE", "memory");
    mocks.sessionUser = { id: "user-test-1", email: "user@example.com" };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("blocks cross-site requests with 403", async () => {
    const res = await POST(createReq({ lineValuesBottomUp: [7, 7, 7, 7, 7, 7] }, "https://malicious.com"));
    expect(res.status).toBe(403);
  });

  it("returns 401 when user is unauthenticated", async () => {
    mocks.sessionUser = null;
    const res = await POST(createReq({ lineValuesBottomUp: [7, 7, 7, 7, 7, 7] }));
    expect(res.status).toBe(401);
  });

  it("returns 422 for invalid line values", async () => {
    const res = await POST(createReq({ lineValuesBottomUp: [7, 7, 7, 7, 7, 10] }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("INVALID_READING_INPUT");
  });

  it("saves a valid 6-line reading and returns a castingId", async () => {
    const res = await POST(createReq({
      lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
      question: "Will this project launch smoothly?",
      scene: "career",
      interpretationGoal: "what_do_i_need_to_see_clearly",
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.castingId).toBeDefined();
    expect(typeof body.castingId).toBe("string");
  });
});
