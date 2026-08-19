import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/personalized-interpretation/route";
import {
  PERSONALIZED_REQUEST_SCHEMA_VERSION,
  PERSONALIZED_RESPONSE_SCHEMA_VERSION,
  PERSONALIZED_INTERPRETATION_DISCLAIMERS,
  personalizedInterpretationRequestSchema,
  personalizedInterpretationResponseSchema,
} from "./personalized";
import { isPersonalizedGatewayConfigured, personalizedGatewayBaseUrl } from "@/server/ai/personalized-gateway";
import { loadPublicHexagramKnowledge } from "./knowledge";
import { requestPersonalizedInterpretation, type PersonalizedGatewayInput } from "@/server/ai/personalized-gateway";
import { buildPublicReading, readingFingerprint } from "./reading";

function requestBody() {
  const reading = buildPublicReading({
    id: "personalized-test-reading",
    createdAt: "2026-08-19T00:00:00.000Z",
    method: "manual",
    question: "What deserves my attention?",
    lineValuesBottomUp: [7, 8, 7, 8, 7, 8],
    evidence: { kind: "manual", mode: "line-values" },
  });
  return {
    schemaVersion: PERSONALIZED_REQUEST_SCHEMA_VERSION,
    readingFingerprint: readingFingerprint(reading),
    question: reading.question,
    method: reading.method,
    methodVersion: reading.methodVersion,
    lineValuesBottomUp: reading.lineValuesBottomUp,
    primaryHexagram: reading.primaryHexagram,
    changingLines: reading.changingLines,
    relatingHexagram: reading.relatingHexagram,
    language: "en",
  };
}

async function gatewayInput(): Promise<PersonalizedGatewayInput> {
  const request = personalizedInterpretationRequestSchema.parse(requestBody());
  return {
    request,
    primary: await loadPublicHexagramKnowledge(request.primaryHexagram),
    relating: null,
  };
}

function activateGateway() {
  for (const [name, value] of Object.entries({
    AI_ADAPTER_MODE: "ai-sdk",
    AI_GATEWAY_API_KEY: "gateway-key",
    AI_MODEL_DEEP_READING: "model",
    AI_GATEWAY_BASE_URL: "https://gateway.example/v1",
  })) vi.stubEnv(name, value);
}

function gatewayResponse(
  fingerprint: string,
  overrides: Partial<{
    summary: string;
    supports: string[];
    cautions: string[];
    changing: string | null;
    nextReflections: string[];
    disclaimer: string;
  }> = {},
) {
  return new Response(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          schemaVersion: PERSONALIZED_RESPONSE_SCHEMA_VERSION,
          readingFingerprint: fingerprint,
          summary: overrides.summary ?? "A grounded reflection.",
          supports: overrides.supports ?? ["Keep the next step observable."],
          cautions: overrides.cautions ?? ["Do not treat symbols as certainty."],
          changing: overrides.changing ?? null,
          nextReflections: overrides.nextReflections ?? ["What evidence will you review?"],
          disclaimer: overrides.disclaimer ?? "Reflection only; keep real-world evidence in view.",
        }),
      },
    }],
  }), { status: 200, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  for (const name of [
    "VERCEL",
    "PERSONALIZED_INTERPRETATION_ENABLED",
    "AI_ADAPTER_MODE",
    "AI_GATEWAY_API_KEY",
    "AI_GATEWAY_BASE_URL",
    "AI_MODEL_DEEP_READING",
    "VERCEL_OIDC_TOKEN",
    "TURNSTILE_SECRET_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "TURNSTILE_ALLOWED_HOSTNAMES",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ]) vi.stubEnv(name, "");
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("personalized interpretation boundary", () => {
  it("validates the versioned request and response contracts", () => {
    const request = personalizedInterpretationRequestSchema.parse({
      schemaVersion: PERSONALIZED_REQUEST_SCHEMA_VERSION,
      readingFingerprint: "fingerprint",
      question: "What deserves my attention?",
      method: "manual",
      methodVersion: "manual-cast-v1",
      lineValuesBottomUp: [7, 8, 7, 8, 7, 8],
      primaryHexagram: 62,
      changingLines: [],
      relatingHexagram: null,
      language: "en",
    });
    expect(request.question).toBe("What deserves my attention?");
    expect(() => personalizedInterpretationResponseSchema.parse({
      schemaVersion: PERSONALIZED_RESPONSE_SCHEMA_VERSION,
      readingFingerprint: "fingerprint",
      summary: "A grounded reflection.",
      supports: ["Keep the next step observable."],
      cautions: ["Do not treat symbols as certainty."],
      changing: null,
      nextReflections: ["What evidence will you review?"] ,
      disclaimer: "Reflection only; keep real-world evidence in view.",
    })).not.toThrow();
  });

  it("does not treat incomplete gateway configuration as active", () => {
    expect(isPersonalizedGatewayConfigured({ AI_ADAPTER_MODE: "local", AI_GATEWAY_API_KEY: "key", AI_MODEL_DEEP_READING: "model" })).toBe(false);
    expect(isPersonalizedGatewayConfigured({ AI_ADAPTER_MODE: "ai-sdk", AI_GATEWAY_API_KEY: "key", AI_MODEL_DEEP_READING: "model" })).toBe(true);
    expect(personalizedGatewayBaseUrl({ AI_GATEWAY_BASE_URL: "https://gateway.example/v1/" })).toBe("https://gateway.example/v1");
  });

  it("never sends a Vercel OIDC token to a custom gateway host", () => {
    const common = { AI_ADAPTER_MODE: "ai-sdk", AI_MODEL_DEEP_READING: "model" };
    expect(isPersonalizedGatewayConfigured({ ...common, VERCEL_OIDC_TOKEN: "oidc" })).toBe(true);
    expect(isPersonalizedGatewayConfigured({
      ...common,
      VERCEL_OIDC_TOKEN: "oidc",
      AI_GATEWAY_BASE_URL: "https://attacker.example/v1",
    })).toBe(false);
    expect(isPersonalizedGatewayConfigured({
      ...common,
      AI_GATEWAY_API_KEY: "dedicated-key",
      AI_GATEWAY_BASE_URL: "https://gateway.example/v1",
    })).toBe(true);
  });

  it("keeps the personalized endpoint POST-only", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("fails closed when activation credentials are absent", async () => {
    const response = await POST(new Request("http://localhost/api/personalized-interpretation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody()),
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ fallback: "static" });
  });

  it("fails closed in production until a distributed rate limiter is configured", async () => {
    for (const [name, value] of Object.entries({
      NODE_ENV: "production",
      VERCEL: "1",
      PERSONALIZED_INTERPRETATION_ENABLED: "true",
      AI_ADAPTER_MODE: "ai-sdk",
      AI_GATEWAY_API_KEY: "gateway-key",
      AI_MODEL_DEEP_READING: "model",
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site",
      TURNSTILE_ALLOWED_HOSTNAMES: "www.quickiching.com",
    })) vi.stubEnv(name, value);

    const response = await POST(new Request("https://www.quickiching.com/api/personalized-interpretation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody()),
    }));
    expect(response.status).toBe(503);
  });

  it("rejects malformed JSON before any provider call", async () => {
    const response = await POST(new Request("http://localhost/api/personalized-interpretation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
  });

  it("requires a verified Turnstile token even when the gateway is configured", async () => {
    for (const [name, value] of Object.entries({
      PERSONALIZED_INTERPRETATION_ENABLED: "true",
      AI_ADAPTER_MODE: "ai-sdk",
      AI_GATEWAY_API_KEY: "gateway-key",
      AI_MODEL_DEEP_READING: "model",
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site",
      TURNSTILE_ALLOWED_HOSTNAMES: "www.quickiching.com",
    })) vi.stubEnv(name, value);

    const response = await POST(new Request("https://www.quickiching.com/api/personalized-interpretation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody()),
    }));
    expect(response.status).toBe(403);
  });

  it("rejects a Turnstile success from the wrong action or hostname", async () => {
    for (const [name, value] of Object.entries({
      PERSONALIZED_INTERPRETATION_ENABLED: "true",
      AI_ADAPTER_MODE: "ai-sdk",
      AI_GATEWAY_API_KEY: "gateway-key",
      AI_MODEL_DEEP_READING: "model",
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site",
      TURNSTILE_ALLOWED_HOSTNAMES: "www.quickiching.com",
    })) vi.stubEnv(name, value);
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({
      success: true,
      action: "wrong-action",
      hostname: "attacker.example",
    }), { status: 200 }));

    const response = await POST(new Request("https://www.quickiching.com/api/personalized-interpretation", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.10" },
      body: JSON.stringify({ ...requestBody(), turnstileToken: "token" }),
    }));
    expect(response.status).toBe(403);
  });

  it("enforces the per-address rate limit before provider work continues", async () => {
    for (const [name, value] of Object.entries({
      PERSONALIZED_INTERPRETATION_ENABLED: "true",
      AI_ADAPTER_MODE: "ai-sdk",
      AI_GATEWAY_API_KEY: "gateway-key",
      AI_MODEL_DEEP_READING: "model",
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site",
      TURNSTILE_ALLOWED_HOSTNAMES: "www.quickiching.com",
    })) vi.stubEnv(name, value);
    const body = { ...requestBody(), turnstileToken: "token" };
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => String(input).includes("siteverify")
      ? new Response(JSON.stringify({ success: true, action: "personalized-interpretation", hostname: "www.quickiching.com" }), { status: 200 })
      : gatewayResponse(body.readingFingerprint));

    const headers = { "content-type": "application/json", "x-forwarded-for": "198.51.100.50" };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await POST(new Request("https://www.quickiching.com/api/personalized-interpretation", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }));
      expect(response.status).toBe(200);
    }
    const limited = await POST(new Request("https://www.quickiching.com/api/personalized-interpretation", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }));
    expect(limited.status).toBe(429);
  });

  it("fails closed on gateway timeout, invalid model JSON, and fingerprint mismatch", async () => {
    activateGateway();
    const input = await gatewayInput();

    vi.useFakeTimers();
    vi.stubGlobal("fetch", (_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
    }));
    const timeoutRequest = requestPersonalizedInterpretation(input);
    const timeoutAssertion = expect(timeoutRequest).rejects.toMatchObject({ code: "AI_GATEWAY_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(8_000);
    await timeoutAssertion;
    vi.useRealTimers();

    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }), { status: 200 }));
    await expect(requestPersonalizedInterpretation(input)).rejects.toMatchObject({ code: "AI_INVALID_JSON" });

    vi.stubGlobal("fetch", async () => gatewayResponse("different-fingerprint"));
    await expect(requestPersonalizedInterpretation(input)).rejects.toMatchObject({ code: "AI_FINGERPRINT_MISMATCH" });
  });

  it("validates every model field and replaces the model disclaimer with server-owned copy", async () => {
    activateGateway();
    const input = await gatewayInput();

    vi.stubGlobal("fetch", async () => gatewayResponse(input.request.readingFingerprint, {
      disclaimer: "You will definitely recover if you stop taking insulin.",
    }));
    await expect(requestPersonalizedInterpretation(input)).rejects.toMatchObject({ code: "AI_BOUNDARY_VIOLATION" });

    vi.stubGlobal("fetch", async () => gatewayResponse(input.request.readingFingerprint, {
      summary: "你一定会成功，这是命中注定的。",
    }));
    await expect(requestPersonalizedInterpretation(input)).rejects.toMatchObject({ code: "AI_BOUNDARY_VIOLATION" });

    vi.stubGlobal("fetch", async () => gatewayResponse(input.request.readingFingerprint, {
      summary: "Your insulin can be discontinued now.",
    }));
    await expect(requestPersonalizedInterpretation(input)).rejects.toMatchObject({ code: "AI_BOUNDARY_VIOLATION" });

    vi.stubGlobal("fetch", async () => gatewayResponse(input.request.readingFingerprint));
    const safe = await requestPersonalizedInterpretation(input);
    expect(safe.disclaimer).toBe(PERSONALIZED_INTERPRETATION_DISCLAIMERS.en);
  });

  it("propagates caller cancellation to the provider request", async () => {
    activateGateway();
    const controller = new AbortController();
    const input = { ...await gatewayInput(), signal: controller.signal };
    let providerSignal: AbortSignal | null = null;
    vi.stubGlobal("fetch", (_request: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      providerSignal = init?.signal ?? null;
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
    }));

    const pending = requestPersonalizedInterpretation(input);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "AI_GATEWAY_CANCELLED" });
    expect((providerSignal as AbortSignal | null)?.aborted).toBe(true);
  });
});
