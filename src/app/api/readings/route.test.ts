import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessionUser: { id: "user-test-1", email: "user@example.com" } as { id: string; email: string } | null,
}));

vi.mock("@/lib/auth/session", () => ({
  resolveSession: async () => (mocks.sessionUser ? { user: mocks.sessionUser } : null),
}));

import { POST } from "./route";
import { repo } from "@/server/repository";
import { generateYarrowLine } from "@/domain/casting/yarrow/algorithm";
import { meiHuaFromUtc } from "@/domain/casting/mei-hua/algorithm";

const CLIENT_CASTING_ID = "2d0a4f0d-37e8-42bf-9232-9d40518f1e4f";

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
    vi.stubEnv("QUESTION_FINGERPRINT_KEYS", "v1:reading-route-test-fingerprint-key");
    mocks.sessionUser = { id: "user-test-1", email: "user@example.com" };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("blocks cross-site requests with 403", async () => {
    const res = await POST(createReq({ clientCastingId: CLIENT_CASTING_ID, lineValuesBottomUp: [7, 7, 7, 7, 7, 7] }, "https://malicious.com"));
    expect(res.status).toBe(403);
  });

  it("returns 401 when user is unauthenticated", async () => {
    mocks.sessionUser = null;
    const res = await POST(createReq({ clientCastingId: CLIENT_CASTING_ID, lineValuesBottomUp: [7, 7, 7, 7, 7, 7] }));
    expect(res.status).toBe(401);
  });

  it("returns 413 for an oversized request body", async () => {
    const res = await POST(createReq({
      clientCastingId: CLIENT_CASTING_ID,
      lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
      question: "x".repeat(17 * 1024),
    }));
    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({ error: "REQUEST_BODY_TOO_LARGE" });
  });

  it("does not expose Zod issue details to the client", async () => {
    const res = await POST(createReq({
      clientCastingId: CLIENT_CASTING_ID,
      lineValuesBottomUp: [5, 7, 7, 7, 7, 7],
    }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body).toEqual({ error: "INVALID_READING_INPUT" });
    expect(body).not.toHaveProperty("details");
  });

  it("returns 422 for invalid line values", async () => {
    const res = await POST(createReq({ clientCastingId: CLIENT_CASTING_ID, lineValuesBottomUp: [7, 7, 7, 7, 7, 10] }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("INVALID_READING_INPUT");
  });

  it("requires the stable browser casting identity", async () => {
    const res = await POST(createReq({
      lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
      question: "Will this project launch smoothly?",
      scene: "career",
      interpretationGoal: "what_do_i_need_to_see_clearly",
    }));
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({ error: "INVALID_READING_INPUT" });
  });

  it("rejects a malformed stable browser casting identity", async () => {
    const res = await POST(createReq({
      clientCastingId: "same-lines-one-hour",
      lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
      question: "Will this project launch smoothly?",
    }));
    expect(res.status).toBe(422);
  });

  it("saves a valid 6-line reading and returns a castingId", async () => {
    const res = await POST(createReq({
      clientCastingId: CLIENT_CASTING_ID,
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
  it("rejects unsupported methods and client-selected algorithm versions", async () => {
    for (const input of [{ method: "manual" }, { method: "three_coin", algorithmVersion: "invented-v1" }]) {
      expect((await POST(createReq({ clientCastingId: CLIENT_CASTING_ID, lineValuesBottomUp: [7,7,7,7,7,7], ...input }))).status).toBe(422);
    }
  });

  it("saves yarrow with its own server-known method and version", async () => {
    const lines = Array.from({ length: 6 }, (_, index) => generateYarrowLine(index as 0, () => 1));
    const response = await POST(createReq({ clientCastingId: CLIENT_CASTING_ID, method: "yarrow_stalk", lineValuesBottomUp: lines.map(line => line.lineValue), methodCalculation: { changes: lines.flatMap(line => line.changes) } }));
    expect(response.status).toBe(201);
    const saved = repo.getCastingSession((await response.json()).castingId);
    expect(saved).toMatchObject({ method: "yarrow_stalk", algorithmVersion: "yarrow-zhu-xi-digital-v2" });
  });

  it("recomputes Mei Hua from its instant and rejects conflicting supplied lines", async () => {
    const methodCalculation = { utcMillis: Date.UTC(2026, 9, 31, 12), ianaTimeZone: "Asia/Shanghai" };
    const result = meiHuaFromUtc(methodCalculation.utcMillis, methodCalculation.ianaTimeZone);
    const response = await POST(createReq({ clientCastingId: CLIENT_CASTING_ID, method: "mei_hua_current_time", lineValuesBottomUp: result.lineValuesBottomUp, methodCalculation }));
    expect(response.status).toBe(201);
    expect(repo.getCastingSession((await response.json()).castingId)).toMatchObject({ method: "mei_hua_current_time", algorithmVersion: result.algorithmVersion });
    expect((await POST(createReq({ clientCastingId: CLIENT_CASTING_ID, method: "mei_hua_current_time", lineValuesBottomUp: [7,7,7,7,7,7], methodCalculation }))).status).toBe(422);
  });

  it("rejects missing, invalid, or inconsistent method evidence", async () => {
    for (const input of [
      { method: "yarrow_stalk" },
      { method: "yarrow_stalk", methodCalculation: { changes: [] } },
      { method: "mei_hua_current_time", methodCalculation: { utcMillis: 0, ianaTimeZone: "Invalid/Zone" } },
    ]) expect((await POST(createReq({ clientCastingId: CLIENT_CASTING_ID, lineValuesBottomUp: [7,7,7,7,7,7], ...input }))).status).toBe(422);
  });

});
