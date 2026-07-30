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
  it("submits the token and optional IP to Cloudflare and accepts only an explicit success response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    const verifier = new TurnstileVerifier({ secret: "turnstile-secret", fetchImpl });

    await expect(verifier.verify({ token: "turnstile-token", remoteIp: "203.0.113.5" })).resolves.toBe(true);
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
    new Response(JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] }), { status: 200 }),
    new Response("provider error", { status: 503 }),
  ])("fails closed for unsuccessful provider responses", async (response) => {
    const verifier = new TurnstileVerifier({
      secret: "turnstile-secret",
      fetchImpl: vi.fn().mockResolvedValue(response),
    });
    await expect(verifier.verify({ token: "turnstile-token", remoteIp: null })).resolves.toBe(false);
  });

  it("rejects a missing token without making a provider request", async () => {
    const fetchImpl = vi.fn();
    const verifier = new TurnstileVerifier({ secret: "turnstile-secret", fetchImpl });
    await expect(verifier.verify({ token: "", remoteIp: null })).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
