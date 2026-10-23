import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptJson, decryptJsonWithKeyMaterial, encryptJson, encryptJsonWithKeyMaterial, hmacWithKeyMaterial, verifyHmacWithKeyMaterial } from "./index";

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


describe("production key safety and derived-key compatibility", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails closed when the legacy APP_SECRET path is used in production without APP_SECRET", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_SECRET", "");
    expect(() => encryptJson({ private: true })).toThrow("APP_SECRET_REQUIRED");
  });

  it("keeps key-material encryption and HMAC formats compatible across repeated derivations", () => {
    const encrypted = encryptJsonWithKeyMaterial({ value: "kept" }, "context", "v7", "stable-key", "cast-1");
    expect(decryptJsonWithKeyMaterial(encrypted, "context", "stable-key", "cast-1")).toEqual({ value: "kept" });
    const signature = hmacWithKeyMaterial("payload", "result-hmac", "v7", "stable-key");
    expect(verifyHmacWithKeyMaterial("payload", signature, "result-hmac", "v7", "stable-key")).toBe(true);
    expect(hmacWithKeyMaterial("payload", "result-hmac", "v7", "stable-key")).toBe(signature);
  });
});
