import { afterEach, describe, expect, it, vi } from "vitest";
import { secureRandomInt } from "./production";

const UINT32_MAX = 0xffff_ffff;

describe("production random integer generation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects the incomplete modulo range before returning a sample", () => {
    const samples = [UINT32_MAX, 7];
    const getRandomValues = vi.fn((target: Uint32Array) => {
      const sample = samples.shift();
      if (sample === undefined) throw new Error("TEST_SAMPLE_EXHAUSTED");
      target[0] = sample;
      return target;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    expect(secureRandomInt(3)).toBe(1);
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });

  it("rejects bounds outside the uint32 sampling domain", () => {
    expect(() => secureRandomInt(0)).toThrow("RANDOM_BOUND_INVALID");
    expect(() => secureRandomInt(0x1_0000_0001)).toThrow("RANDOM_BOUND_INVALID");
  });
});
