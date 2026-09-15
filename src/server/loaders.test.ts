import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAnonymousHash: vi.fn(),
  getPostgresClient: vi.fn(),
  listCastsForUser: vi.fn(),
  getBatches: vi.fn(),
  decryptQuestionForGeneration: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
  getAnonymousHash: mocks.getAnonymousHash,
}));

vi.mock("@/server/db/client", () => ({
  getPostgresClient: mocks.getPostgresClient,
}));

vi.mock("@/server/generation/question-crypto", () => ({
  decryptQuestionForGeneration: mocks.decryptQuestionForGeneration,
}));

vi.mock("@/server/repository", () => ({
  repo: {
    listCastsForUser: mocks.listCastsForUser,
    getBatches: mocks.getBatches,
  },
}));

import { loadCastingView, loadEntitlementBalance, loadHistory } from "./loaders";

const privateRow = {
  id: "24aaac9c-1107-4c83-bd50-1ea3c7758fde",
  user_id: "user-1",
  method: "three_coin",
  lifecycle: "revealed",
  risk_status: "allowed",
  scene: "career",
  interpretation_goal: "what_do_i_need_to_see_clearly",
  generation_epoch: 0,
  deleted_at: null,
  created_at: new Date("2026-09-15T00:00:00Z"),
  updated_at: new Date("2026-09-15T00:00:00Z"),
  question_version_id: "11111111-1111-4111-8111-111111111111",
  question_ciphertext: "secret",
  question_iv: "iv",
  question_auth_tag: "tag",
  question_encryption_key_version: "v1",
  line_values: [7, 8, 9, 6, 7, 8],
  primary_hexagram_number: 63,
  moving_line_positions: [3, 4],
  relating_hexagram_number: 49,
  algorithm_version: "three-coin-v1",
  classic_mapping_version: "king-wen-v1",
  reading_job_id: "22222222-2222-4222-8222-222222222222",
  reading_output: { executiveSummary: "private paid report" },
};

describe("commercial account loaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DATABASE_ADAPTER_MODE", "postgres");
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@db.example.com/quickiching");
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.getAnonymousHash.mockResolvedValue(null);
    mocks.decryptQuestionForGeneration.mockReturnValue("private question");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when PostgreSQL history query fails instead of returning memory history", async () => {
    const databaseError = new Error("DB_CONNECTION_LOST");
    mocks.getPostgresClient.mockReturnValue(vi.fn(() => Promise.reject(databaseError)));
    mocks.listCastsForUser.mockReturnValue([]);

    await expect(loadHistory()).rejects.toThrow("DB_CONNECTION_LOST");
    expect(mocks.listCastsForUser).not.toHaveBeenCalled();
  });

  it("fails closed when PostgreSQL entitlement query fails instead of returning a synthetic zero balance", async () => {
    const databaseError = new Error("DB_CONNECTION_LOST");
    mocks.getPostgresClient.mockReturnValue(vi.fn(() => Promise.reject(databaseError)));
    mocks.getBatches.mockReturnValue([]);

    await expect(loadEntitlementBalance()).rejects.toThrow("DB_CONNECTION_LOST");
    expect(mocks.getBatches).not.toHaveBeenCalled();
  });

  it("retains the in-memory path when PostgreSQL mode is not configured", async () => {
    vi.stubEnv("DATABASE_ADAPTER_MODE", "memory");
    vi.stubEnv("DATABASE_URL", "");
    mocks.listCastsForUser.mockReturnValue([]);
    mocks.getBatches.mockReturnValue([]);

    await expect(loadHistory()).resolves.toEqual([]);
    await expect(loadEntitlementBalance()).resolves.toEqual({ available: 0, expiringSoon: 0 });
    expect(mocks.getPostgresClient).not.toHaveBeenCalled();
  });

  it("does not return a persisted private casting to an unauthenticated reader", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.getPostgresClient.mockReturnValue(vi.fn(async () => [privateRow]));

    await expect(loadCastingView(privateRow.id)).resolves.toBeNull();
    expect(mocks.decryptQuestionForGeneration).not.toHaveBeenCalled();
  });

  it("does not return another user's persisted private casting", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-2" });
    mocks.getPostgresClient.mockReturnValue(vi.fn(async () => [privateRow]));

    await expect(loadCastingView(privateRow.id)).resolves.toBeNull();
    expect(mocks.decryptQuestionForGeneration).not.toHaveBeenCalled();
  });

  it("returns the private question, cast and paid report to the owner", async () => {
    mocks.getPostgresClient.mockReturnValue(vi.fn(async () => [privateRow]));

    const view = await loadCastingView(privateRow.id);
    expect(view?.owns).toBe(true);
    expect(view?.context).toBe("private question");
    expect(view?.result?.lineValues).toEqual(privateRow.line_values);
    expect(view?.reading?.report).toEqual(privateRow.reading_output);
  });
});
