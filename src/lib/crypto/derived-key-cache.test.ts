import type { BinaryLike, ScryptOptions } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scryptSyncSpy = vi.hoisted(() => vi.fn());

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    scryptSync: (
      password: BinaryLike,
      salt: BinaryLike,
      keyLength: number,
      options?: ScryptOptions,
    ) => {
      scryptSyncSpy();
      return actual.scryptSync(password, salt, keyLength, options);
    },
  };
});

describe("derived key caching", () => {
  beforeEach(() => {
    scryptSyncSpy.mockClear();
    vi.resetModules();
  });

  it("derives one purpose and key version only once per process", async () => {
    const { hmac } = await import("./index");

    hmac("first rate-limit subject", "anon");
    hmac("second rate-limit subject", "anon");

    expect(scryptSyncSpy).toHaveBeenCalledTimes(1);
  });
});
