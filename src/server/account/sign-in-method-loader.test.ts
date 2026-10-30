import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sql: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/server/db/client", () => ({ getPostgresClient: () => mocks.sql }));
import { loadSignInMethods } from "./sign-in-method-loader";
describe("read-only sign-in method loader", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("DATABASE_ADAPTER_MODE", "postgres"); vi.stubEnv("DATABASE_URL", "postgres://fixture"); mocks.user.mockResolvedValue({ id: "owner", email: "owner@example.com" }); });
  afterEach(() => vi.unstubAllEnvs());
  it("reads only the authenticated user's linked providers, without tokens", async () => {
    mocks.sql.mockResolvedValue([{ provider_id: "google", email_verified: true }]);
    expect(await loadSignInMethods()).toEqual(["Google"]);
    const [strings, ...values] = mocks.sql.mock.calls[0];
    expect(strings.join("?")).not.toMatch(/access_token|refresh_token|id_token/);
    expect(values).toContain("owner");
  });
  it("supports verified Magic Link users with no account row", async () => {
    mocks.sql.mockResolvedValue([{ provider_id: null, email_verified: true }]);
    expect(await loadSignInMethods()).toEqual(["Email (Magic Link)"]);
  });
  it("keeps all linked methods, deduplicated", async () => {
    mocks.sql.mockResolvedValue([{ provider_id: "google", email_verified: true }, { provider_id: "email", email_verified: true }, { provider_id: "google", email_verified: true }]);
    expect(await loadSignInMethods()).toEqual(["Google", "Email (Magic Link)"]);
  });
  it("does not invent a method for missing or unverified data", async () => {
    mocks.sql.mockResolvedValue([{ provider_id: null, email_verified: false }]);
    expect(await loadSignInMethods()).toEqual([]);
  });
  it("does not read accounts without a session", async () => {
    mocks.user.mockResolvedValue(null);
    expect(await loadSignInMethods()).toEqual([]);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
  it("propagates database failures", async () => {
    mocks.sql.mockRejectedValue(new Error("DB_UNAVAILABLE"));
    await expect(loadSignInMethods()).rejects.toThrow("DB_UNAVAILABLE");
  });
});
