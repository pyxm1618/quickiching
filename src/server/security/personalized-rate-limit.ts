import { createHash } from "node:crypto";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;
const STORAGE_TIMEOUT_MS = 2_000;
const MAX_LOCAL_BUCKETS = 1_000;
const UPSTASH_HOST_SUFFIX = ".upstash.io";
const localBuckets = new Map<string, { count: number; resetAt: number }>();

type RateLimitEnv = Record<string, string | undefined>;

function envValue(env: RateLimitEnv, name: string): string {
  return env[name]?.trim() ?? "";
}

function upstashUrl(env: RateLimitEnv): URL | null {
  try {
    const url = new URL(envValue(env, "UPSTASH_REDIS_REST_URL"));
    if (url.protocol !== "https:" || !url.hostname.endsWith(UPSTASH_HOST_SUFFIX)) return null;
    return url;
  } catch {
    return null;
  }
}

export function isPersonalizedRateLimitConfigured(env: RateLimitEnv = process.env): boolean {
  if (envValue(env, "NODE_ENV") !== "production") return true;
  return envValue(env, "VERCEL") === "1"
    && Boolean(upstashUrl(env))
    && Boolean(envValue(env, "UPSTASH_REDIS_REST_TOKEN"));
}

export function personalizedRequestAddress(request: Request, env: RateLimitEnv = process.env): string {
  const header = envValue(env, "NODE_ENV") === "production" && envValue(env, "VERCEL") === "1"
    ? "x-vercel-forwarded-for"
    : "x-forwarded-for";
  return request.headers.get(header)?.split(",")[0]?.trim() || "unknown";
}

function localRateLimitAllows(address: string, now: number): boolean {
  for (const [key, bucket] of localBuckets) {
    if (bucket.resetAt <= now) localBuckets.delete(key);
  }
  if (localBuckets.size >= MAX_LOCAL_BUCKETS && !localBuckets.has(address)) return false;

  const current = localBuckets.get(address);
  if (!current) {
    localBuckets.set(address, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_REQUESTS) return false;
  current.count += 1;
  return true;
}

const FIXED_WINDOW_SCRIPT = [
  "local current = redis.call('INCR', KEYS[1])",
  "if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "return current",
].join("\n");

export async function checkPersonalizedRateLimit(
  request: Request,
  options: { env?: RateLimitEnv; now?: number; signal?: AbortSignal } = {},
): Promise<boolean> {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now();
  const address = personalizedRequestAddress(request, env);
  if (envValue(env, "NODE_ENV") !== "production") return localRateLimitAllows(address, now);
  if (!isPersonalizedRateLimitConfigured(env)) return false;

  const url = upstashUrl(env);
  if (!url) return false;
  const addressHash = createHash("sha256").update(address).digest("hex");
  const window = Math.floor(now / WINDOW_MS);
  const key = `quickiching:personalized:${window}:${addressHash}`;
  const controller = new AbortController();
  const cancelFromCaller = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) cancelFromCaller();
  else options.signal?.addEventListener("abort", cancelFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error("RATE_LIMIT_TIMEOUT")), STORAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${envValue(env, "UPSTASH_REDIS_REST_TOKEN")}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify(["EVAL", FIXED_WINDOW_SCRIPT, 1, key, WINDOW_MS]),
    });
    if (!response.ok) return false;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return false;
    const result = (payload as { result?: unknown }).result;
    return typeof result === "number" && Number.isInteger(result) && result >= 1 && result <= MAX_REQUESTS;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", cancelFromCaller);
  }
}
