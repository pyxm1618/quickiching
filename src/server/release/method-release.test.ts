import { describe, expect, it } from "vitest";
import { ALGORITHM_VERSIONS } from "@/domain/casting/types";
import { ProductionMethodReleasePolicy } from "./method-release";

describe("ProductionMethodReleasePolicy", () => {
  it("always releases the reviewed three-coin method", () => {
    const policy = new ProductionMethodReleasePolicy({});
    expect(policy.isReleased("three_coin")).toBe(true);
    expect(() => policy.assertReleased("three_coin")).not.toThrow();
  });

  it("fails closed when an external ruleset approval is absent or references another version", () => {
    const absent = new ProductionMethodReleasePolicy({});
    expect(() => absent.assertReleased("yarrow_stalk"))
      .toThrowError(expect.objectContaining({ code: "METHOD_NOT_RELEASED", field: "method" }));
    expect(() => absent.assertReleased("mei_hua_current_time"))
      .toThrowError(expect.objectContaining({ code: "METHOD_NOT_RELEASED", field: "method" }));

    const stale = new ProductionMethodReleasePolicy({
      YARROW_RULESET_APPROVED_VERSION: "yarrow-v0",
      MEI_HUA_RULESET_APPROVED_VERSION: "mei-hua-v0",
    });
    expect(stale.isReleased("yarrow_stalk")).toBe(false);
    expect(stale.isReleased("mei_hua_current_time")).toBe(false);
  });

  it("releases each method only for the exact algorithm version reviewed", () => {
    const policy = new ProductionMethodReleasePolicy({
      YARROW_RULESET_APPROVED_VERSION: ALGORITHM_VERSIONS.yarrow_stalk,
      MEI_HUA_RULESET_APPROVED_VERSION: ALGORITHM_VERSIONS.mei_hua_current_time,
    });
    expect(policy.isReleased("yarrow_stalk")).toBe(true);
    expect(policy.isReleased("mei_hua_current_time")).toBe(true);
    expect(() => policy.assertReleased("yarrow_stalk")).not.toThrow();
    expect(() => policy.assertReleased("mei_hua_current_time")).not.toThrow();
  });
});
