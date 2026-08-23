import { describe, expect, it, vi } from "vitest";
import {
  devSignIn,
  getCurrentUser,
  AuthInfrastructureUnavailableError,
  parseAnonymousOwnerKeys,
  signAnonymousCookieValue,
  verifyAnonymousCookieValue,
} from "./session";
import { signCookie } from "@/lib/crypto";

vi.mock("@/server/auth/capability", () => ({
  isAuthCapabilityEnabled: () => true,
}));

describe("development authentication isolation", () => {
  it("cannot create a memory/dev session in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(devSignIn("user@example.com")).rejects.toThrow("DEV_AUTH_DISABLED");
    vi.unstubAllEnvs();
  });

  it("accepts a valid CP1 cookie during the CP2 key migration and can re-sign it", () => {
    const keys = [
      { version: "v2", material: "current-owner-key" },
      { version: "v1", material: "historical-owner-key" },
    ];
    const legacy = signCookie("cp1-owner-digest");

    expect(verifyAnonymousCookieValue(legacy, keys)).toMatchObject({
      payload: "cp1-owner-digest",
      source: "legacy",
    });
    const migrated = signAnonymousCookieValue("cp1-owner-digest", keys);
    expect(verifyAnonymousCookieValue(migrated, keys)).toMatchObject({
      payload: "cp1-owner-digest",
      source: "current",
      version: "v2",
    });
  });

  it("signs with the current key, verifies historical keys, and rejects unknown key versions", () => {
    const currentAndHistory = [
      { version: "v2", material: "current-owner-key" },
      { version: "v1", material: "historical-owner-key" },
    ];
    const historical = signAnonymousCookieValue("owner-digest", [currentAndHistory[1]!]);

    expect(verifyAnonymousCookieValue(historical, currentAndHistory)).toMatchObject({
      payload: "owner-digest",
      source: "current",
      version: "v1",
    });
    expect(verifyAnonymousCookieValue(historical, [currentAndHistory[0]!])).toBeNull();
    expect(parseAnonymousOwnerKeys("v1:key,v1:duplicate")).toBeNull();
    expect(parseAnonymousOwnerKeys("not-versioned")).toBeNull();
  });

  it("distinguishes Auth infrastructure failure from an unauthenticated session", async () => {
    await expect(getCurrentUser()).rejects.toBeInstanceOf(AuthInfrastructureUnavailableError);
    await expect(getCurrentUser({ allowUnavailable: true })).resolves.toBeNull();
  });
});
