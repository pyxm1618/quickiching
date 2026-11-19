import { describe, expect, it } from "vitest";
import { CANONICAL_PRODUCTION_VERCEL_PROJECT_ID } from "./vercel-deployment.mjs";
import { isNonProductionVercelDeployment, publicRobotsMetadata, publicRobotsRoute } from "./indexing-policy";

const canonical = {
  VERCEL: "1",
  VERCEL_ENV: "production",
  VERCEL_PROJECT_ID: CANONICAL_PRODUCTION_VERCEL_PROJECT_ID,
  VERCEL_GIT_COMMIT_REF: "main",
};

describe("indexing policy", () => {
  it("keeps only the canonical production Vercel project indexable", () => {
    expect(isNonProductionVercelDeployment(canonical)).toBe(false);
    expect(publicRobotsMetadata(canonical)).toEqual({ index: true, follow: true });
    expect(publicRobotsRoute(canonical)).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
      sitemap: "https://www.quickiching.com/sitemap.xml",
      host: "www.quickiching.com",
    });
  });

  it("fails closed on the dedicated staging project even when Vercel calls its target production", () => {
    const staging = {
      VERCEL: "1",
      VERCEL_ENV: "production",
      VERCEL_PROJECT_ID: "prj_iKtw9xKmIlEfe44gEocgLr2QDLfE",
      VERCEL_GIT_COMMIT_REF: "staging",
    };
    expect(isNonProductionVercelDeployment(staging)).toBe(true);
    expect(publicRobotsMetadata(staging)).toEqual({ index: false, follow: false });
    expect(publicRobotsRoute(staging)).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("fails closed on previews and unknown Vercel projects while leaving local QA indexable", () => {
    expect(isNonProductionVercelDeployment({
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_PROJECT_ID: CANONICAL_PRODUCTION_VERCEL_PROJECT_ID,
    })).toBe(true);
    expect(isNonProductionVercelDeployment({
      VERCEL: "1",
      VERCEL_ENV: "production",
      VERCEL_PROJECT_ID: "prj_unknown",
      VERCEL_GIT_COMMIT_REF: "main",
    })).toBe(true);
    expect(isNonProductionVercelDeployment({})).toBe(false);
    expect(publicRobotsMetadata({})).toEqual({ index: true, follow: true });
  });
});
