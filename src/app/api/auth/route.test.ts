import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH, POST } from "./[...all]/route";

vi.mock("@/server/auth/capability", () => ({
  isAuthCapabilityEnabled: () => process.env.TEST_AUTH_CAPABILITY_ENABLED === "true",
}));

const authEnvironment = {
  COMMERCIAL_V2_AUTH_ENABLED: "true",
  COMMERCIAL_V2_AI_PREVIEW_ENABLED: "false",
  COMMERCIAL_V2_CHECKOUT_ENABLED: "false",
  COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "false",
  COMMERCIAL_V2_PAID_DEEP_READING_ENABLED: "false",
  COMMERCIAL_V2_RECONCILE_ENABLED: "false",
  AUTH_ADAPTER_MODE: "better-auth",
  DATABASE_ADAPTER_MODE: "postgres",
  DATABASE_URL: "postgresql://user:password@db.example.com/quickiching",
  BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "https://www.quickiching.com",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  RESEND_API_KEY: "resend-api-key",
  EMAIL_FROM: "Quick I Ching <noreply@example.com>",
  ANONYMOUS_OWNER_KEYS: "v1:anonymous-owner-secret",
};

describe("Auth route capability gate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("does not initialize Better Auth or reveal configuration when disabled", async () => {
    const response = await GET(new Request("https://www.quickiching.com/api/auth/get-session"));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("explicitly rejects methods outside the Next.js GET/POST surface", async () => {
    vi.stubEnv("TEST_AUTH_CAPABILITY_ENABLED", "true");
    for (const [name, value] of Object.entries(authEnvironment)) vi.stubEnv(name, value);

    const response = await PATCH(new Request("https://www.quickiching.com/api/auth/get-session"));

    expect(response.status).toBe(405);
    expect(await response.text()).toBe("Method Not Allowed");
  });

  it.each([
    ["malformed JSON", "{"],
    ["invalid email", JSON.stringify({ email: "not-an-email", callbackURL: "/signin" })],
  ])("returns 400 for %s instead of an infrastructure 503", async (_label, body) => {
    vi.stubEnv("TEST_AUTH_CAPABILITY_ENABLED", "true");
    for (const [name, value] of Object.entries(authEnvironment)) vi.stubEnv(name, value);

    const response = await POST(new Request("https://www.quickiching.com/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }));

    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("0123456789abcdef0123456789abcdef");
  });
});
