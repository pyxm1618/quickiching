import { isIP } from "node:net";
import { hmac } from "@/lib/crypto";
import { runtimeConfig } from "@/server/config";
import { DomainError } from "@/server/errors/domain-error";
import type { PostgresRateLimiter, TurnstileVerifier } from "./abuse-controls";

export type RateLimitDimension = {
  kind: "anonymous" | "email" | "user" | "order";
  value: string;
  limit: number;
  windowMs: number;
};

function firstAddress(value: string | null): string | null {
  if (!value) return null;
  const candidate = value.split(",", 1)[0]?.trim() ?? "";
  return isIP(candidate) ? candidate : null;
}

export function trustedClientIp(requestHeaders: Headers): string | null {
  return firstAddress(requestHeaders.get("x-vercel-forwarded-for"))
    ?? firstAddress(requestHeaders.get("cf-connecting-ip"))
    ?? firstAddress(requestHeaders.get("x-real-ip"));
}

function dimensionKey(action: string, kind: string, value: string): string {
  return `${action}:${kind}:${hmac(value.normalize("NFKC").trim().toLowerCase(), "anon")}`;
}

function rateLimited(): never {
  throw new DomainError(
    "RATE_LIMITED",
    "Too many requests. Please try again later.",
    true,
  );
}

export async function guardSensitiveRequest(input: {
  action: string;
  turnstileToken: string | undefined;
  requestHeaders: Headers;
  rateLimiter: PostgresRateLimiter;
  turnstile: TurnstileVerifier;
  dimensions: RateLimitDimension[];
  now: Date;
}): Promise<{ clientIp: string | null }> {
  const clientIp = trustedClientIp(input.requestHeaders);
  const coarseIp = await input.rateLimiter.consume({
    key: dimensionKey(input.action, "ip-preflight", clientIp ?? "unknown"),
    limit: 30,
    cost: 1,
    windowMs: 60_000,
    now: input.now,
  });
  if (!coarseIp.allowed) rateLimited();

  const config = runtimeConfig();
  if (config.mode !== "production") throw new Error("PRODUCTION_CONFIG_REQUIRED");
  const validChallenge = await input.turnstile.verify({
    token: input.turnstileToken ?? "",
    remoteIp: clientIp,
    expectedAction: input.action,
    expectedHostname: new URL(config.credentials.publicAppUrl).hostname,
    now: input.now,
  });
  if (!validChallenge) {
    throw new DomainError(
      "TURNSTILE_VERIFICATION_FAILED",
      "Please complete the verification challenge and try again.",
      false,
      "turnstileToken",
    );
  }

  const limits = [
    {
      kind: "ip",
      value: clientIp ?? "unknown",
      limit: Math.max(1, Math.min(...input.dimensions.map((dimension) => dimension.limit * 3), 30)),
      windowMs: Math.max(...input.dimensions.map((dimension) => dimension.windowMs), 60_000),
    },
    ...input.dimensions,
  ];
  for (const dimension of limits) {
    const result = await input.rateLimiter.consume({
      key: dimensionKey(input.action, dimension.kind, dimension.value),
      limit: dimension.limit,
      cost: 1,
      windowMs: dimension.windowMs,
      now: input.now,
    });
    if (!result.allowed) rateLimited();
  }
  return { clientIp };
}
