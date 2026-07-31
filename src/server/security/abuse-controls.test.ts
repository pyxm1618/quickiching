import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";
import { PostgresRateLimiter, TurnstileVerifier } from "./abuse-controls";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("PostgresRateLimiter", () => {
  let sql: Sql;

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 10 });
    await migratePostgres(sql);
  });
  beforeEach(async () => resetPostgresForTests(sql));
  afterAll(async () => { if (sql) await sql.end(); });

  it("allows exactly the configured number of concurrent mutations per fixed window", async () => {
    const limiter = new PostgresRateLimiter(sql);
    const now = new Date("2026-07-30T00:00:00.000Z");
    const results = await Promise.all(Array.from({ length: 8 }, () => limiter.consume({
      key: "anon:abc:create-casting",
      limit: 5,
      cost: 1,
      windowMs: 60_000,
      now,
    })));

    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(3);
    expect(new Set(results.map((result) => result.resetAt.toISOString()))).toHaveLength(1);
  });

  it("starts a fresh bucket after the database-backed window expires", async () => {
    const limiter = new PostgresRateLimiter(sql);
    const start = new Date("2026-07-30T00:00:00.000Z");
    expect((await limiter.consume({ key: "usr:1:preview", limit: 1, cost: 1, windowMs: 1000, now: start })).allowed).toBe(true);
    expect((await limiter.consume({ key: "usr:1:preview", limit: 1, cost: 1, windowMs: 1000, now: start })).allowed).toBe(false);
    expect((await limiter.consume({
      key: "usr:1:preview", limit: 1, cost: 1, windowMs: 1000, now: new Date(start.getTime() + 1001),
    })).allowed).toBe(true);
  });
});

describe("TurnstileVerifier", () => {
  const now = new Date("2026-07-31T01:00:00.000Z");
  const validResponse = {
    success: true,
    action: "reveal_casting",
    hostname: "iching.example.com",
    challenge_ts: "2026-07-31T00:58:00.000Z",
  };

  it("submits the token and optional IP and accepts an exact fresh action/hostname match", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(validResponse), { status: 200 }));
    const verifier = new TurnstileVerifier({ secret: "turnstile-secret", fetchImpl });

    await expect(verifier.verify({
      token: "turnstile-token",
      remoteIp: "203.0.113.5",
      expectedAction: "reveal_casting",
      expectedHostname: "iching.example.com",
      now,
    })).resolves.toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const body = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(body)).toEqual({
      secret: "turnstile-secret",
      response: "turnstile-token",
      remoteip: "203.0.113.5",
    });
  });

  it.each([
    ["wrong action", { ...validResponse, action: "create_casting" }],
    ["wrong hostname", { ...validResponse, hostname: "attacker.example" }],
    ["stale challenge", { ...validResponse, challenge_ts: "2026-07-31T00:54:59.999Z" }],
    ["future challenge", { ...validResponse, challenge_ts: "2026-07-31T01:01:00.001Z" }],
    ["missing metadata", { success: true }],
  ])("fails closed for %s", async (_label, body) => {
    const verifier = new TurnstileVerifier({
      secret: "turnstile-secret",
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })),
    });
    await expect(verifier.verify({
      token: "turnstile-token",
      remoteIp: null,
      expectedAction: "reveal_casting",
      expectedHostname: "iching.example.com",
      now,
    })).resolves.toBe(false);
  });

  it.each([
    new Response(JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] }), { status: 200 }),
    new Response("provider error", { status: 503 }),
  ])("fails closed for unsuccessful provider responses", async (response) => {
    const verifier = new TurnstileVerifier({
      secret: "turnstile-secret",
      fetchImpl: vi.fn().mockResolvedValue(response),
    });
    await expect(verifier.verify({
      token: "turnstile-token",
      remoteIp: null,
      expectedAction: "reveal_casting",
      expectedHostname: "iching.example.com",
      now,
    })).resolves.toBe(false);
  });

  it("rejects a missing token without making a provider request", async () => {
    const fetchImpl = vi.fn();
    const verifier = new TurnstileVerifier({ secret: "turnstile-secret", fetchImpl });
    await expect(verifier.verify({
      token: "",
      remoteIp: null,
      expectedAction: "reveal_casting",
      expectedHostname: "iching.example.com",
      now,
    })).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
