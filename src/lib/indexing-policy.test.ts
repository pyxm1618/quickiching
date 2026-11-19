import { describe, expect, it } from "vitest";
import { isNonProductionVercelDeployment, publicRobotsMetadata } from "./indexing-policy";

describe("indexing policy", () => {
  it("keeps canonical production indexable", () => {
    const env = { VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" };
    expect(isNonProductionVercelDeployment(env)).toBe(false);
    expect(publicRobotsMetadata(env)).toEqual({ index: true, follow: true });
  });

  it("fails closed on the staging branch even if Vercel treats it as production", () => {
    const env = { VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "staging" };
    expect(isNonProductionVercelDeployment(env)).toBe(true);
    expect(publicRobotsMetadata(env)).toEqual({ index: false, follow: false });
  });

  it("fails closed on any Vercel preview while leaving local development unaffected", () => {
    expect(publicRobotsMetadata({ VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "staging" }))
      .toEqual({ index: false, follow: false });
    expect(publicRobotsMetadata({}))
      .toEqual({ index: true, follow: true });
  });
});
