import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/crypto", () => ({
  hmac: (value: string) => `digest-${value}`,
}));
vi.mock("@/server/config", () => ({
  runtimeConfig: () => ({
    mode: "production",
    credentials: { publicAppUrl: "https://iching.example.com" },
  }),
}));

import { guardSensitiveRequest, trustedClientIp } from "./sensitive-request-guard";

describe("trustedClientIp", () => {
  it("prefers a valid platform forwarding header and rejects malformed spoofed values", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "203.0.113.9, 10.0.0.1",
      "cf-connecting-ip": "198.51.100.4",
      "x-real-ip": "192.0.2.8",
    });
    expect(trustedClientIp(headers)).toBe("203.0.113.9");

    expect(trustedClientIp(new Headers({
      "x-vercel-forwarded-for": "not-an-ip",
      "cf-connecting-ip": "198.51.100.4",
    }))).toBe("198.51.100.4");
    expect(trustedClientIp(new Headers({
      "x-vercel-forwarded-for": "attacker.example",
      "cf-connecting-ip": "also-invalid",
    }))).toBeNull();
  });
});

describe("guardSensitiveRequest", () => {
  it("validates Turnstile before consuming HMAC-only subject dimensions", async () => {
    const consumed: Array<Record<string, unknown>> = [];
    const rateLimiter = {
      consume: vi.fn(async (input: Record<string, unknown>) => {
        consumed.push(input);
        return { allowed: true, remaining: 1, resetAt: new Date("2026-07-31T01:10:00.000Z") };
      }),
    };
    const turnstile = {
      verify: vi.fn(async () => true),
    };
    const now = new Date("2026-07-31T01:00:00.000Z");

    await expect(guardSensitiveRequest({
      action: "reveal_casting",
      turnstileToken: "challenge-token",
      requestHeaders: new Headers({ "x-vercel-forwarded-for": "203.0.113.9" }),
      rateLimiter: rateLimiter as never,
      turnstile: turnstile as never,
      dimensions: [
        { kind: "anonymous", value: "anon-sensitive", limit: 5, windowMs: 600_000 },
        { kind: "email", value: "Owner@Example.COM", limit: 3, windowMs: 600_000 },
      ],
      now,
    })).resolves.toEqual({ clientIp: "203.0.113.9" });

    expect(turnstile.verify).toHaveBeenCalledWith({
      token: "challenge-token",
      remoteIp: "203.0.113.9",
      expectedAction: "reveal_casting",
      expectedHostname: "iching.example.com",
      now,
    });
    expect(consumed).toHaveLength(4);
    const keys = consumed.map((input) => String(input.key));
    expect(keys.every((key) => key.includes("digest-") && !key.includes("203.0.113.9"))).toBe(true);
    expect(keys.every((key) => !key.includes("owner@example.com") && !key.includes("anon-sensitive"))).toBe(true);
  });

  it("fails before subject limits when the challenge is invalid", async () => {
    const rateLimiter = {
      consume: vi.fn(async () => ({
        allowed: true,
        remaining: 29,
        resetAt: new Date("2026-07-31T01:01:00.000Z"),
      })),
    };
    const turnstile = { verify: vi.fn(async () => false) };

    await expect(guardSensitiveRequest({
      action: "create_checkout",
      turnstileToken: "invalid-token",
      requestHeaders: new Headers({ "x-real-ip": "192.0.2.1" }),
      rateLimiter: rateLimiter as never,
      turnstile: turnstile as never,
      dimensions: [{ kind: "user", value: "usr_secret", limit: 5, windowMs: 600_000 }],
      now: new Date("2026-07-31T01:00:00.000Z"),
    })).rejects.toMatchObject({
      code: "TURNSTILE_VERIFICATION_FAILED",
      field: "turnstileToken",
    });
    expect(rateLimiter.consume).toHaveBeenCalledTimes(1);
  });

  it("rejects when any one of the independent dimensions is exhausted", async () => {
    let call = 0;
    const rateLimiter = {
      consume: vi.fn(async () => {
        call++;
        return {
          allowed: call !== 4,
          remaining: 0,
          resetAt: new Date("2026-07-31T01:10:00.000Z"),
        };
      }),
    };
    const turnstile = { verify: vi.fn(async () => true) };

    await expect(guardSensitiveRequest({
      action: "reveal_casting",
      turnstileToken: "valid-token",
      requestHeaders: new Headers({ "cf-connecting-ip": "198.51.100.9" }),
      rateLimiter: rateLimiter as never,
      turnstile: turnstile as never,
      dimensions: [
        { kind: "anonymous", value: "anon-1", limit: 5, windowMs: 600_000 },
        { kind: "email", value: "owner@example.com", limit: 3, windowMs: 600_000 },
      ],
      now: new Date("2026-07-31T01:00:00.000Z"),
    })).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});
