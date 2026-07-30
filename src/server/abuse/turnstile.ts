import { DomainError } from "@/server/errors/domain-error";

type SiteverifyResponse = {
  success: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

export class TurnstileVerifier {
  constructor(private readonly dependencies: {
    secret: string;
    fetchImpl?: typeof fetch;
    endpoint?: string;
  }) {
    if (!dependencies.secret) throw new Error("TURNSTILE_SECRET_REQUIRED");
  }

  async verify(input: {
    token: string;
    action: string;
    hostname: string;
    remoteIp?: string;
    idempotencyKey: string;
  }): Promise<SiteverifyResponse> {
    if (!input.token || input.token.length > 2048) {
      throw new DomainError("TURNSTILE_INVALID", "Human verification failed. Please try again.", true);
    }
    const response = await (this.dependencies.fetchImpl ?? fetch)(
      this.dependencies.endpoint ?? "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          secret: this.dependencies.secret,
          response: input.token,
          remoteip: input.remoteIp,
          idempotency_key: input.idempotencyKey,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      throw new DomainError("TURNSTILE_UNAVAILABLE", "Human verification is temporarily unavailable.", true);
    }
    const result = await response.json() as SiteverifyResponse;
    if (!result.success || result.action !== input.action || result.hostname !== input.hostname) {
      throw new DomainError("TURNSTILE_INVALID", "Human verification failed. Please try again.", true);
    }
    return result;
  }
}
