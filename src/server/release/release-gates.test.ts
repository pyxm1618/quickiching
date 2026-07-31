import { describe, expect, it } from "vitest";
import {
  assertPublicReleaseApproved,
  blockedExternalReleaseGateIds,
  isExternalReleaseGateApproved,
  isReleaseGateRecordApproved,
} from "./release-gates";

describe("public release gates", () => {
  it("keeps every unresolved external gate blocked", () => {
    expect(blockedExternalReleaseGateIds()).toEqual([
      "G-01", "G-02", "G-03", "G-04", "G-05",
      "G-06", "G-07", "G-08", "G-09", "G-10",
    ]);
    expect(isExternalReleaseGateApproved("G-03")).toBe(false);
  });

  it("accepts only an approved gate with non-empty archived evidence paths", () => {
    expect(isReleaseGateRecordApproved({
      id: "G-test",
      status: "approved",
      approvalEvidence: ["docs/approvals/g-test.md"],
    })).toBe(true);
    expect(isReleaseGateRecordApproved({
      id: "G-test",
      status: "approved",
      approvalEvidence: [],
    })).toBe(false);
    expect(isReleaseGateRecordApproved({
      id: "G-test",
      status: "approved",
      approvalEvidence: ["   "],
    })).toBe(false);
    expect(isReleaseGateRecordApproved({
      id: "G-test",
      status: "blocked_external",
      approvalEvidence: ["docs/approvals/g-test.md"],
    })).toBe(false);
  });

  it("blocks a public production runtime even when environment flags claim approval", () => {
    expect(() => assertPublicReleaseApproved({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      YARROW_RULESET_APPROVED_VERSION: "yarrow-v1",
      MEI_HUA_RULESET_APPROVED_VERSION: "mei-hua-v1",
    })).toThrow("PUBLIC_RELEASE_BLOCKED: G-01,G-02,G-03,G-04,G-05,G-06,G-07,G-08,G-09,G-10");
  });

  it("does not let a non-Vercel production runtime spoof preview mode", () => {
    expect(() => assertPublicReleaseApproved({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
    })).toThrow("PUBLIC_RELEASE_BLOCKED: G-01,G-02,G-03,G-04,G-05,G-06,G-07,G-08,G-09,G-10");
  });

  it("allows development and an actual Vercel preview deployment for testing", () => {
    expect(() => assertPublicReleaseApproved({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertPublicReleaseApproved({
      NODE_ENV: "production",
      VERCEL: "1",
      VERCEL_ENV: "preview",
    })).not.toThrow();
  });
});
