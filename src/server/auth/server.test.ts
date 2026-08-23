import { describe, expect, it } from "vitest";
import type { AuthDatabase } from "@/server/db/client";
import { buildAuthOptions } from "./server";

const env = {
  NODE_ENV: "test",
  BETTER_AUTH_URL: "https://www.quickiching.com",
  BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM: "Quick I Ching <noreply@example.com>",
};

describe("Better Auth server options", () => {
  it("uses the current Better Auth security boundaries", () => {
    const options = buildAuthOptions({} as AuthDatabase, env, {
      sendMagicLink: async () => undefined,
    });

    expect(options).toMatchObject({
      appName: "Quick I Ching",
      baseURL: env.BETTER_AUTH_URL,
      basePath: "/api/auth",
      trustedOrigins: ["https://www.quickiching.com"],
      account: {
        accountLinking: {
          enabled: true,
          disableImplicitLinking: true,
          requireLocalEmailVerified: true,
          trustedProviders: [],
        },
        encryptOAuthTokens: true,
        storeStateStrategy: "database",
      },
      advanced: {
        useSecureCookies: false,
        disableOriginCheck: false,
      },
    });
    expect(options.socialProviders?.google).toMatchObject({
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
      requireEmailVerification: true,
    });
    expect(options.plugins?.map((plugin) => plugin.id)).toEqual(["magic-link", "next-cookies"]);
    expect(options.plugins?.[0]).toMatchObject({
      id: "magic-link",
      options: { expiresIn: 600, storeToken: "hashed" },
    });
  });

  it("marks Better Auth cookies Secure in production", () => {
    const options = buildAuthOptions({} as AuthDatabase, {
      ...env,
      NODE_ENV: "production",
    }, { sendMagicLink: async () => undefined });
    expect(options.advanced?.defaultCookieAttributes).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("rejects an insecure production origin and unapproved trusted origins", () => {
    expect(() => buildAuthOptions({} as AuthDatabase, {
      ...env,
      NODE_ENV: "production",
      BETTER_AUTH_URL: "http://www.quickiching.com",
    }, { sendMagicLink: async () => undefined })).toThrow("AUTH_CONFIGURATION_UNAVAILABLE");

    expect(() => buildAuthOptions({} as AuthDatabase, {
      ...env,
      NODE_ENV: "production",
      BETTER_AUTH_TRUSTED_ORIGINS: "https://www.quickiching.com,http://localhost:3000",
    }, { sendMagicLink: async () => undefined })).toThrow("AUTH_CONFIGURATION_UNAVAILABLE");
  });

  it("does not accept an unverified OAuth email as an account identity", async () => {
    const options = buildAuthOptions({} as AuthDatabase, env, {
      sendMagicLink: async () => undefined,
    });
    const validateUserInfo = options.user?.validateUserInfo;
    expect(validateUserInfo).toBeDefined();
    await expect(validateUserInfo!({
      user: { email: "user@example.com", emailVerified: false },
      source: { method: "oauth", oauth: { providerId: "google", profile: {} } },
    } as never, {} as never)).resolves.toMatchObject({ error: "provider_email_unverified" });
  });
});
