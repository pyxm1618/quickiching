import { describe, expect, it } from "vitest";
import { resolveVercelBuildPlan } from "./vercel-build-plan";

describe("resolveVercelBuildPlan", () => {
  it("runs database migrations before the build for the dedicated staging deployment", () => {
    expect(
      resolveVercelBuildPlan({
        QUICKICHING_DEPLOYMENT_TIER: "staging",
        APP_BASE_URL: "https://staging.quickiching.com",
      }),
    ).toEqual(["db:migrate", "build"]);
  });

  it("does not migrate the formal project by default", () => {
    expect(
      resolveVercelBuildPlan({
        APP_BASE_URL: "https://quickiching.com",
      }),
    ).toEqual(["build"]);
  });

  it("refuses a staging migration against any other public URL", () => {
    expect(() =>
      resolveVercelBuildPlan({
        QUICKICHING_DEPLOYMENT_TIER: "staging",
        APP_BASE_URL: "https://quickiching.com",
      }),
    ).toThrow("STAGING_MIGRATION_TARGET_REJECTED");
  });
});
