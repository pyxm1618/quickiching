import { describe, expect, it } from "vitest";
import type { VersionedKeySet } from "@/server/config";
import {
  assertAllowedCallbackPath,
  createLoginHandoffState,
  emailMatches,
  hashLoginExpectedEmail,
  hashLoginIntentNonce,
  nonceMatches,
  verifyLoginHandoffState,
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

describe("cross-browser Login Intent handoff", () => {
  it("signs an opaque state without exposing intent metadata and verifies it after key rotation", () => {
    const token = "opaque-random-token-with-at-least-256-bits-of-source-entropy";
    const state = createLoginHandoffState(token, keys.read[1]);

    expect(state).not.toContain("casting");
    expect(state).not.toContain("owner@example.com");
    expect(verifyLoginHandoffState(state, keys)).toEqual({
      token,
      keyVersion: "v1",
    });
  });

  it("rejects a modified state and a state signed by a retired key", () => {
    const state = createLoginHandoffState("opaque-token", keys.read[0]);
    expect(verifyLoginHandoffState(`${state}tampered`, keys)).toBeNull();

    const retiredState = createLoginHandoffState("opaque-token", {
      version: "retired",
      value: "retired-key",
    });
    expect(verifyLoginHandoffState(retiredState, keys)).toBeNull();
  });

  it("binds the handoff to a normalized authenticated email using timing-safe comparison", () => {
    const stored = hashLoginExpectedEmail(" Owner@Example.COM ", keys.read[1]);

    expect(emailMatches(stored, "v1", "owner@example.com", keys)).toBe(true);
    expect(emailMatches(stored, "v1", "attacker@example.com", keys)).toBe(false);
    expect(emailMatches(stored, "retired", "owner@example.com", keys)).toBe(false);
  });
});
