import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson, hmacWithKeyMaterial } from "./index";

describe("AES-GCM context binding", () => {
  it("rejects a question ciphertext when its casting or version binding changes", () => {
    const encrypted = encryptJson({ context: "A private question" }, "context", "v1", "cast-1:qv-1");

    expect(decryptJson(encrypted, "context", "cast-1:qv-1")).toEqual({ context: "A private question" });
    expect(() => decryptJson(encrypted, "context", "cast-2:qv-1")).toThrow();
  });
});

describe("purpose-isolated HMAC material", () => {
  it("does not reuse a Better Auth or unrelated application secret for owner digests", () => {
    expect(hmacWithKeyMaterial("owner", "anonymous-owner", "v1", "owner-key"))
      .not.toBe(hmacWithKeyMaterial("owner", "anonymous-owner", "v1", "different-owner-key"));
  });
});
