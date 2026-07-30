import { describe, expect, it, vi } from "vitest";
import { TurnstileVerifier } from "./turnstile";

describe("TurnstileVerifier", () => {
  it("accepts a single-use token only when action and hostname match", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      action: "checkout",
      hostname: "ichingcoin.com",
      "error-codes": [],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const verifier = new TurnstileVerifier({ secret: "secret", fetchImpl });

    await expect(verifier.verify({
      token: "token",
      action: "checkout",
      hostname: "ichingcoin.com",
      remoteIp: "203.0.113.4",
      idempotencyKey: "0e4f7d09-a880-4841-9f67-99b51b6ef245",
    })).resolves.toMatchObject({ success: true });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toMatchObject({
      secret: "secret",
      response: "token",
      remoteip: "203.0.113.4",
      idempotency_key: "0e4f7d09-a880-4841-9f67-99b51b6ef245",
    });
  });

  it.each([
    { success: true, action: "login", hostname: "ichingcoin.com", "error-codes": [] },
    { success: true, action: "checkout", hostname: "evil.example", "error-codes": [] },
    { success: false, action: "checkout", hostname: "ichingcoin.com", "error-codes": ["timeout-or-duplicate"] },
  ])("rejects invalid, replayed, or context-mismatched tokens", async (payload) => {
    const verifier = new TurnstileVerifier({
      secret: "secret",
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })),
    });
    await expect(verifier.verify({
      token: "token",
      action: "checkout",
      hostname: "ichingcoin.com",
      idempotencyKey: crypto.randomUUID(),
    })).rejects.toThrow("TURNSTILE_INVALID");
  });
});
