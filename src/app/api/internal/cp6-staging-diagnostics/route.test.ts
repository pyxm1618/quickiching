import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collect: vi.fn(),
  collectWaffo: vi.fn(),
}));

vi.mock("@/server/readiness/staging-runtime-diagnostics", () => ({
  collectStagingRuntimeDiagnostics: mocks.collect,
}));

vi.mock("@/server/readiness/waffo-staging-catalog-read", () => ({
  collectWaffoTestCatalogDiagnostics: mocks.collectWaffo,
}));

import { DELETE, GET, PATCH, POST, PUT } from "./route";

const maintenanceToken = "cp6-maintenance-token-with-enough-random-material";
const stagingProjectId = "prj_iKtw9xKmIlEfe44gEocgLr2QDLfE";

function request(token = maintenanceToken): Request {
  return new Request("https://staging.quickiching.com/api/internal/cp6-staging-diagnostics", {
    method: "GET",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("CP6 staging runtime diagnostics route", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_ID", stagingProjectId);
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "staging.quickiching.com");
    vi.stubEnv("QUICKICHING_DEPLOYMENT_TIER", "staging");
    vi.stubEnv("APP_BASE_URL", "https://staging.quickiching.com");
    vi.stubEnv("CP6_STAGING_MAINTENANCE_TOKEN", maintenanceToken);
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "0123456789abcdef0123456789abcdef01234567");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "codex/commercial-v2-cp6-repair");
    mocks.collect.mockReset().mockResolvedValue({
      database: {
        connected: true,
        migrationTablePresent: true,
        migrationStatus: "ok",
        appliedMigrationCount: 12,
        expectedMigrationCount: 12,
        missingTables: [],
        presentCp5CoreTables: ["audit_events", "workflow_runs"],
        classification: "ready",
      },
      provider: {
        waffoEnvironmentIsTest: true,
        originChecks: { appBaseUrl: true, publicAppUrl: true, betterAuthUrl: true },
      },
      capabilities: { actual: {}, prerequisitesIfRequested: {} },
    });
    mocks.collectWaffo.mockReset().mockResolvedValue({
      ok: true,
      environment: "test",
      model: "one_time",
      store: { id: "STO_test", status: "active" },
      packs: [
        { pack: 1, productId: "PROD_one", amountMinor: 299, currency: "USD", status: "active", hasTestVersion: true },
        { pack: 3, productId: "PROD_three", amountMinor: 699, currency: "USD", status: "active", hasTestVersion: true },
        { pack: 5, productId: "PROD_five", amountMinor: 999, currency: "USD", status: "active", hasTestVersion: true },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is hidden outside the exact staging Vercel Production project", async () => {
    vi.stubEnv("VERCEL_PROJECT_ID", "prj_wrong");
    expect((await GET(request())).status).toBe(404);
    expect(mocks.collect).not.toHaveBeenCalled();
    expect(mocks.collectWaffo).not.toHaveBeenCalled();

    vi.stubEnv("VERCEL_PROJECT_ID", stagingProjectId);
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "www.quickiching.com");
    expect((await GET(request())).status).toBe(404);
    expect(mocks.collect).not.toHaveBeenCalled();
    expect(mocks.collectWaffo).not.toHaveBeenCalled();

    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "staging.quickiching.com");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await GET(request())).status).toBe(404);
    expect(mocks.collect).not.toHaveBeenCalled();
    expect(mocks.collectWaffo).not.toHaveBeenCalled();
  });

  it("requires the staging deployment tier, staging app origin, and a maintenance token", async () => {
    vi.stubEnv("QUICKICHING_DEPLOYMENT_TIER", "production");
    expect((await GET(request())).status).toBe(404);

    vi.stubEnv("QUICKICHING_DEPLOYMENT_TIER", "staging");
    vi.stubEnv("APP_BASE_URL", "https://www.quickiching.com");
    expect((await GET(request())).status).toBe(404);

    vi.stubEnv("APP_BASE_URL", "https://staging.quickiching.com");
    vi.stubEnv("CP6_STAGING_MAINTENANCE_TOKEN", "");
    expect((await GET(request())).status).toBe(404);
  });

  it("returns 401 for missing or incorrect bearer authorization", async () => {
    expect((await GET(request(""))).status).toBe(401);
    expect((await GET(request("wrong-token"))).status).toBe(401);
    expect(mocks.collect).not.toHaveBeenCalled();
    expect(mocks.collectWaffo).not.toHaveBeenCalled();
  });

  it("returns only sanitised structured diagnostics including authoritative Waffo Test catalog facts", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");

    const body = await response.json();
    expect(body.deployment).toEqual({
      environment: "production",
      projectIdMatchesStaging: true,
      productionUrlMatchesStaging: true,
      tierConfigured: true,
      appBaseUrlMatchesStaging: true,
      gitSha: "0123456789abcdef0123456789abcdef01234567",
      gitRef: "codex/commercial-v2-cp6-repair",
    });
    expect(body.database.classification).toBe("ready");
    expect(body.waffoCatalog).toEqual({
      ok: true,
      environment: "test",
      model: "one_time",
      store: { id: "STO_test", status: "active" },
      packs: [
        { pack: 1, productId: "PROD_one", amountMinor: 299, currency: "USD", status: "active", hasTestVersion: true },
        { pack: 3, productId: "PROD_three", amountMinor: 699, currency: "USD", status: "active", hasTestVersion: true },
        { pack: 5, productId: "PROD_five", amountMinor: 999, currency: "USD", status: "active", hasTestVersion: true },
      ],
    });
    expect(mocks.collectWaffo).toHaveBeenCalledTimes(1);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(maintenanceToken);
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain(stagingProjectId);
    expect(serialized).not.toContain("WAFFO_PRIVATE_KEY");
  });

  it("returns a sanitised 500 when the runtime diagnostic collector fails", async () => {
    mocks.collect.mockRejectedValueOnce(new Error("postgresql://secret:password@db.example.com/prod"));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "CP6_STAGING_DIAGNOSTICS_FAILED" });
  });

  it("returns provider-read failure as sanitised evidence rather than leaking or hiding it", async () => {
    mocks.collectWaffo.mockResolvedValueOnce({
      ok: false,
      environment: "test",
      reason: "WAFFO_PROVIDER_READ_FAILED",
    });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect((await response.json()).waffoCatalog).toEqual({
      ok: false,
      environment: "test",
      reason: "WAFFO_PROVIDER_READ_FAILED",
    });
  });

  it("rejects non-GET methods", async () => {
    expect((await POST()).status).toBe(405);
    expect((await PUT()).status).toBe(405);
    expect((await PATCH()).status).toBe(405);
    expect((await DELETE()).status).toBe(405);
  });
});
