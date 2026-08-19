import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkPersonalizedRateLimit,
  isPersonalizedRateLimitConfigured,
} from "./personalized-rate-limit";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("personalized interpretation rate limit", () => {
  it("requires a Vercel runtime and a dedicated Upstash REST credential in production", () => {
    expect(isPersonalizedRateLimitConfigured({ NODE_ENV: "development" })).toBe(true);
    expect(isPersonalizedRateLimitConfigured({ NODE_ENV: "production", VERCEL: "1" })).toBe(false);
    expect(isPersonalizedRateLimitConfigured({
      NODE_ENV: "production",
      VERCEL: "1",
      UPSTASH_REDIS_REST_URL: "https://example.com",
      UPSTASH_REDIS_REST_TOKEN: "secret",
    })).toBe(false);
    expect(isPersonalizedRateLimitConfigured({
      NODE_ENV: "production",
      VERCEL: "1",
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "secret",
    })).toBe(true);
  });

  it("uses the trusted Vercel address, hashes it, and fails closed at the global limit", async () => {
    const env = {
      NODE_ENV: "production",
      VERCEL: "1",
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "secret",
    };
    const request = new Request("https://www.quickiching.com/api/personalized-interpretation", {
      headers: {
        "x-forwarded-for": "203.0.113.99",
        "x-vercel-forwarded-for": "198.51.100.24",
      },
    });
    let sentBody = "";
    vi.stubGlobal("fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
      sentBody = String(init?.body ?? "");
      expect(init?.headers).toMatchObject({ Authorization: "Bearer secret" });
      return new Response(JSON.stringify({ result: 6 }), { status: 200 });
    });

    await expect(checkPersonalizedRateLimit(request, { env })).resolves.toBe(false);
    expect(sentBody).not.toContain("198.51.100.24");
    expect(sentBody).not.toContain("203.0.113.99");
    expect(sentBody).toContain("quickiching:personalized:");
  });

  it("allows requests below the distributed limit and fails closed on malformed storage responses", async () => {
    const env = {
      NODE_ENV: "production",
      VERCEL: "1",
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "secret",
    };
    const request = new Request("https://www.quickiching.com/api/personalized-interpretation", {
      headers: { "x-vercel-forwarded-for": "198.51.100.25" },
    });
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ result: 5 }), { status: 200 }));
    await expect(checkPersonalizedRateLimit(request, { env })).resolves.toBe(true);

    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ result: "five" }), { status: 200 }));
    await expect(checkPersonalizedRateLimit(request, { env })).resolves.toBe(false);
  });
});
