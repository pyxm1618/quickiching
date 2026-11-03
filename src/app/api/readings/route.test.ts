import { randomUUID } from "node:crypto";
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
import { meiHuaFromNumberAndTime } from "@/domain/casting/mei-hua/number-time";

let CLIENT_CASTING_ID = randomUUID();

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
    CLIENT_CASTING_ID = randomUUID();
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
  it("rejects client-selected unsupported algorithm versions", async () => {
    expect((await POST(createReq({
      clientCastingId: CLIENT_CASTING_ID,
      method: "three_coin",
      algorithmVersion: "invented-v1",
      lineValuesBottomUp: [7,7,7,7,7,7],
    }))).status).toBe(422);
  });

  it("saves Manual line-values with the canonical method and stable client id", async () => {
    const response = await POST(createReq({
      clientCastingId: CLIENT_CASTING_ID,
      method: "manual",
      algorithmVersion: "manual-cast-v1",
      lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
      methodCalculation: { mode: "line-values" },
      question: "What should I understand about this choice?",
    }));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ castingId: CLIENT_CASTING_ID, idempotent: false });
    expect(repo.getCastingSession(CLIENT_CASTING_ID)).toMatchObject({
      id: CLIENT_CASTING_ID,
      method: "manual",
      algorithmVersion: "manual-cast-v1",
      lifecycle: "revealed",
    });
    expect(repo.getLatestQuestionContext(CLIENT_CASTING_ID)).toBe("What should I understand about this choice?");
  });

  it("validates Manual primary-changing evidence and rejects duplicate or conflicting positions", async () => {
    const valid = {
      clientCastingId: CLIENT_CASTING_ID,
      method: "manual",
      algorithmVersion: "manual-cast-v1",
      lineValuesBottomUp: [7, 7, 7, 7, 7, 7],
      methodCalculation: { mode: "primary-changing", primaryHexagramNumber: 1, changingLines: [] },
    };
    expect((await POST(createReq(valid))).status).toBe(201);

    expect((await POST(createReq({
      ...valid,
      clientCastingId: randomUUID(),
      methodCalculation: { mode: "primary-changing", primaryHexagramNumber: 1, changingLines: [1, 1] },
    }))).status).toBe(422);

    expect((await POST(createReq({
      ...valid,
      clientCastingId: randomUUID(),
      lineValuesBottomUp: [8, 8, 8, 8, 8, 8],
    }))).status).toBe(422);
  });

  it("is idempotent for the same stable id and rejects different content under that id", async () => {
    const input = {
      clientCastingId: CLIENT_CASTING_ID,
      method: "manual",
      lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
      methodCalculation: { mode: "line-values" },
      question: "What should I understand?",
    };
    expect((await POST(createReq(input))).status).toBe(201);
    const retry = await POST(createReq(input));
    expect(retry.status).toBe(200);
    await expect(retry.json()).resolves.toMatchObject({ castingId: CLIENT_CASTING_ID, idempotent: true });

    const conflict = await POST(createReq({ ...input, lineValuesBottomUp: [7, 7, 7, 7, 7, 7] }));
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({ error: "READING_IDEMPOTENCY_CONFLICT" });
  });

  it("allows the same question to be saved as two distinct casts with different stable ids", async () => {
    const question = "Should I continue with the same plan?";
    const first = await POST(createReq({
      clientCastingId: randomUUID(),
      lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
      question,
    }));
    const second = await POST(createReq({
      clientCastingId: randomUUID(),
      lineValuesBottomUp: [8, 7, 8, 7, 8, 7],
      question,
    }));
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it("saves yarrow with its own server-known method and version", async () => {
    const lines = Array.from({ length: 6 }, (_, index) => generateYarrowLine(index as 0, () => 1));
    const response = await POST(createReq({ clientCastingId: CLIENT_CASTING_ID, method: "yarrow_stalk", lineValuesBottomUp: lines.map(line => line.lineValue), methodCalculation: { changes: lines.flatMap(line => line.changes) } }));
    expect(response.status).toBe(201);
    const saved = repo.getCastingSession((await response.json()).castingId);
    expect(saved).toMatchObject({ method: "yarrow_stalk", algorithmVersion: "yarrow-zhu-xi-digital-v2" });
  });

  it("recomputes active Mei Hua number + moment evidence and rejects conflicting supplied lines", async () => {
    const methodCalculation = { number: 17, utcMillis: Date.UTC(2026, 9, 31, 12), ianaTimeZone: "Asia/Shanghai" };
    const result = meiHuaFromNumberAndTime(methodCalculation);
    const response = await POST(createReq({ clientCastingId: CLIENT_CASTING_ID, method: "mei_hua_number_time", lineValuesBottomUp: result.lineValuesBottomUp, methodCalculation }));
    expect(response.status).toBe(201);
    expect(repo.getCastingSession((await response.json()).castingId)).toMatchObject({ method: "mei_hua_number_time", algorithmVersion: result.algorithmVersion });
    expect((await POST(createReq({ clientCastingId: CLIENT_CASTING_ID, method: "mei_hua_number_time", lineValuesBottomUp: [7,7,7,7,7,7], methodCalculation }))).status).toBe(422);
  });

  it("rejects creation of historical current-time Mei Hua casts", async () => {
    expect((await POST(createReq({
      clientCastingId: CLIENT_CASTING_ID,
      method: "mei_hua_current_time",
      lineValuesBottomUp: [7,7,7,7,7,7],
      methodCalculation: { utcMillis: Date.UTC(2026, 9, 31, 12), ianaTimeZone: "Asia/Shanghai" },
    }))).status).toBe(422);
  });

  it("rejects missing, invalid, or inconsistent method evidence", async () => {
    for (const input of [
      { method: "yarrow_stalk" },
      { method: "yarrow_stalk", methodCalculation: { changes: [] } },
      { method: "mei_hua_number_time", methodCalculation: { number: 17, utcMillis: 0, ianaTimeZone: "Invalid/Zone" } },
      { method: "mei_hua_number_time", methodCalculation: { number: 0, utcMillis: 0, ianaTimeZone: "UTC" } },
    ]) expect((await POST(createReq({ clientCastingId: CLIENT_CASTING_ID, lineValuesBottomUp: [7,7,7,7,7,7], ...input }))).status).toBe(422);
  });

});
