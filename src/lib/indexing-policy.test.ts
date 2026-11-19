import { describe, expect, it } from "vitest";
import { isNonProductionVercelDeployment, publicRobotsRoute } from "./indexing-policy";

describe("indexing policy", () => {
  it("keeps canonical production indexable", () => {
    const env = { VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" };
    expect(isNonProductionVercelDeployment(env)).toBe(false);
    expect(publicRobotsRoute(env)).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
      sitemap: "https://www.quickiching.com/sitemap.xml",
      host: "www.quickiching.com",
    });
  });

  it("fails closed on the staging branch even if Vercel treats it as production", () => {
    const env = { VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "staging" };
    expect(isNonProductionVercelDeployment(env)).toBe(true);
    expect(publicRobotsRoute(env)).toEqual({
      rules: { userAgent: "*", disallow: "/" },
    });
  });

  it("fails closed on any Vercel preview while leaving local development production-like for QA", () => {
    expect(publicRobotsRoute({ VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feature/test" }))
      .toEqual({ rules: { userAgent: "*", disallow: "/" } });
    expect(isNonProductionVercelDeployment({})).toBe(false);
  });
});
