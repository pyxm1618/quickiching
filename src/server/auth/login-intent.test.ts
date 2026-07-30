import { describe, expect, it } from "vitest";
import type { VersionedKeySet } from "@/server/config";
import {
  assertAllowedCallbackPath,
  hashLoginIntentNonce,
  nonceMatches,
} from "./login-intent";

const keys: VersionedKeySet = {
  writeVersion: "v2",
  read: [
    { version: "v2", value: "new-session-signing-key" },
    { version: "v1", value: "old-session-signing-key" },
  ],
};

describe("Login Intent callback boundary", () => {
  it.each(["/cast", "/result/cas_0123456789abcdef01234567", "/account?tab=history"])(
    "accepts an internal callback path: %s",
    (path) => {
      expect(assertAllowedCallbackPath(path)).toBe(path);
    },
  );

  it.each([
    "https://attacker.example/steal",
    "//attacker.example/steal",
    "/\\attacker.example/steal",
    "javascript:alert(1)",
    "result/cas_0123456789abcdef01234567",
  ])("rejects an external or ambiguous callback path: %s", (path) => {
    expect(() => assertAllowedCallbackPath(path)).toThrow("LOGIN_INTENT_CALLBACK_INVALID");
  });
});

describe("Login Intent nonce hashing", () => {
  it("stores a versioned hash and accepts a nonce through the configured read key set", () => {
    const stored = hashLoginIntentNonce("single-use-nonce", keys.read[1]);

    expect(stored).not.toContain("single-use-nonce");
    expect(nonceMatches(stored, "v1", "single-use-nonce", keys)).toBe(true);
    expect(nonceMatches(stored, "v1", "wrong-nonce", keys)).toBe(false);
  });

  it("fails closed when the stored key version is no longer readable", () => {
    const stored = hashLoginIntentNonce("single-use-nonce", {
      version: "retired",
      value: "retired-key",
    });

    expect(nonceMatches(stored, "retired", "single-use-nonce", keys)).toBe(false);
  });
});
