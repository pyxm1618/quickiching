import { describe, expect, it, vi } from "vitest";
import { buildProductionAuthOptions, sendMagicLinkWithResend } from "./production-auth";

const credentials = {
  betterAuthSecret: "better-auth-secret-at-least-32-characters-long",
  betterAuthUrl: "https://example.com",
  googleClientId: "google-client-id",
  googleClientSecret: "google-client-secret",
  resendApiKey: "re_test_key",
  emailFrom: "I Ching Coin <hello@example.com>",
};

describe("production authentication", () => {
  it("uses Better Auth logical model names with the Drizzle schema table mapping", () => {
    const options = buildProductionAuthOptions(credentials, {
      database: { kind: "test-database" },
      sendMagicLink: vi.fn(),
    });

    expect(options).toMatchObject({
      baseURL: "https://example.com",
      secret: credentials.betterAuthSecret,
      socialProviders: {
        google: {
          clientId: "google-client-id",
          clientSecret: "google-client-secret",
        },
      },
      magicLinkPolicy: {
        expiresIn: 600,
        storeToken: "hashed",
        atomicSingleUse: true,
      },
    });
    expect(options).not.toHaveProperty("user");
    expect(options).not.toHaveProperty("session");
    expect(options).not.toHaveProperty("account");
    expect(options).not.toHaveProperty("verification");
  });

  it("sends a bounded Resend request without placing the token in headers or logs", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ id: "email_1" }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const url = "https://example.com/api/auth/magic-link/verify?token=secret-token";

    await sendMagicLinkWithResend({
      email: "user@example.com",
      url,
      apiKey: credentials.resendApiKey,
      from: credentials.emailFrom,
      fetchImpl,
    });

    const [endpoint, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe("https://api.resend.com/emails");
    expect(init.headers).toEqual({
      authorization: "Bearer re_test_key",
      "content-type": "application/json",
    });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      from: credentials.emailFrom,
      to: ["user@example.com"],
      subject: "Your I Ching Coin sign-in link",
    });
    expect(body.html).toContain(url.replaceAll("&", "&amp;"));
    expect(JSON.stringify(init.headers)).not.toContain("secret-token");
  });

  it("rejects non-HTTPS magic-link URLs before sending email", async () => {
    await expect(sendMagicLinkWithResend({
      email: "user@example.com",
      url: "http://example.com/magic?token=secret",
      apiKey: credentials.resendApiKey,
      from: credentials.emailFrom,
      fetchImpl: vi.fn(),
    })).rejects.toThrow("MAGIC_LINK_URL_INVALID");
  });
});
