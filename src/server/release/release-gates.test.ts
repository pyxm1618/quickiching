import { describe, expect, it } from "vitest";
import {
  assertPublicReleaseApproved,
  blockedExternalReleaseGateIds,
  isExternalReleaseGateApproved,
} from "./release-gates";

describe("public release gates", () => {
  it("keeps every unresolved external gate blocked", () => {
    expect(blockedExternalReleaseGateIds()).toEqual([
      "G-01", "G-02", "G-03", "G-04", "G-05",
      "G-06", "G-07", "G-08", "G-09", "G-10",
    ]);
    expect(isExternalReleaseGateApproved("G-03")).toBe(false);
  });

  it("blocks a public production runtime even when environment flags claim approval", () => {
    expect(() => assertPublicReleaseApproved({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      YARROW_RULESET_APPROVED_VERSION: "yarrow-v1",
      MEI_HUA_RULESET_APPROVED_VERSION: "mei-hua-v1",
    })).toThrow("PUBLIC_RELEASE_BLOCKED: G-01,G-02,G-03,G-04,G-05,G-06,G-07,G-08,G-09,G-10");
  });

  it("allows development and preview environments for testing", () => {
    expect(() => assertPublicReleaseApproved({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertPublicReleaseApproved({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
    })).not.toThrow();
  });
});
