import { afterEach, describe, expect, it } from "vitest";
import { decryptJson, encryptJson, signCookie, verifyCookie } from "./index";

const originalAppSecret = process.env.APP_SECRET;

afterEach(() => {
  if (originalAppSecret === undefined) delete process.env.APP_SECRET;
  else process.env.APP_SECRET = originalAppSecret;
});

describe("AES-GCM context binding", () => {
  it("rejects a question ciphertext when its casting or version binding changes", () => {
    const encrypted = encryptJson({ context: "A private question" }, "context", "v1", "cast-1:qv-1");

    expect(decryptJson(encrypted, "context", "cast-1:qv-1")).toEqual({ context: "A private question" });
    expect(() => decryptJson(encrypted, "context", "cast-2:qv-1")).toThrow();
  });

  it("does not derive encryption keys from the legacy APP_SECRET environment variable", () => {
    process.env.APP_SECRET = "legacy-secret-a";
    const encrypted = encryptJson({ context: "A private question" }, "context", undefined, "cast-1:qv-1");
    process.env.APP_SECRET = "legacy-secret-b";

    expect(decryptJson(encrypted, "context", "cast-1:qv-1")).toEqual({ context: "A private question" });
  });
});

describe("signed cookies", () => {
  it("encodes the key version and rejects a modified payload", () => {
    const signed = signCookie("session_123");

    expect(signed.startsWith("v1.")).toBe(true);
    expect(verifyCookie(signed)).toBe("session_123");
    expect(verifyCookie(signed.replace("session_123", "session_456"))).toBeNull();
  });
});
