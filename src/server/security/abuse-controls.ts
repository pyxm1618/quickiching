import type { Sql } from "postgres";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

export class PostgresRateLimiter {
  constructor(private readonly sql: Sql) {}

  async consume(input: {
    key: string;
    limit: number;
    cost: number;
    windowMs: number;
    now: Date;
  }): Promise<RateLimitResult> {
    if (!input.key || !Number.isSafeInteger(input.limit) || input.limit <= 0) {
      throw new Error("RATE_LIMIT_CONFIG_INVALID");
    }
    if (!Number.isSafeInteger(input.cost) || input.cost <= 0 || input.cost > input.limit) {
      throw new Error("RATE_LIMIT_COST_INVALID");
    }
    if (!Number.isSafeInteger(input.windowMs) || input.windowMs <= 0) {
      throw new Error("RATE_LIMIT_WINDOW_INVALID");
    }

    const startedAtMs = Math.floor(input.now.getTime() / input.windowMs) * input.windowMs;
    const windowStartedAt = new Date(startedAtMs);
    const resetAt = new Date(startedAtMs + input.windowMs);
    const changed = await this.sql`
      insert into rate_limit_buckets (
        bucket_key, window_started_at, window_expires_at, used, updated_at
      ) values (
        ${input.key}, ${windowStartedAt}, ${resetAt}, ${input.cost}, ${input.now}
      )
      on conflict (bucket_key, window_started_at)
      do update set
        used = rate_limit_buckets.used + ${input.cost},
        updated_at = ${input.now}
      where rate_limit_buckets.used + ${input.cost} <= ${input.limit}
      returning used
    `;

    if (changed.length > 0) {
      const used = Number(changed[0].used);
      return { allowed: true, remaining: Math.max(0, input.limit - used), resetAt };
    }
    const existing = await this.sql`
      select used from rate_limit_buckets
      where bucket_key = ${input.key} and window_started_at = ${windowStartedAt}
    `;
    const used = existing.length > 0 ? Number(existing[0].used) : input.limit;
    return { allowed: false, remaining: Math.max(0, input.limit - used), resetAt };
  }

  async purgeExpired(now: Date): Promise<number> {
    const deleted = await this.sql`
      delete from rate_limit_buckets where window_expires_at <= ${now}
      returning bucket_key
    `;
    return deleted.length;
  }
}

export class TurnstileVerifier {
  constructor(private readonly dependencies: {
    secret: string;
    fetchImpl?: typeof fetch;
  }) {}

  async verify(input: { token: string; remoteIp: string | null }): Promise<boolean> {
    const token = input.token.trim();
    if (!token || !this.dependencies.secret.trim()) return false;
    const body = new URLSearchParams({
      secret: this.dependencies.secret,
      response: token,
    });
    if (input.remoteIp) body.set("remoteip", input.remoteIp);

    try {
      const response = await (this.dependencies.fetchImpl ?? fetch)(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: body.toString(),
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!response.ok) return false;
      const result = await response.json() as { success?: unknown };
      return result.success === true;
    } catch {
      return false;
    }
  }
}
