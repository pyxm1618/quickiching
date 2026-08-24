import type { NormalizedWaffoWebhook } from "./waffo-webhook";

type WebhookRepository = {
  recordVerifiedEvent(event: NormalizedWaffoWebhook): Promise<{
    inboxId: string;
    duplicate: "delivery" | "event" | null;
  }>;
  processInbox(inboxId: string): Promise<{ outcome: string; reason?: string }>;
  recordProcessingFailure(inboxId: string, errorCode: string): Promise<{
    deadLetter: boolean;
    attemptCount: number;
  }>;
};

export class WebhookServiceError extends Error {
  constructor(readonly code: "WEBHOOK_PROCESSING_UNAVAILABLE", readonly retryable: boolean) {
    super(code);
    this.name = "WebhookServiceError";
  }
}

export function createWaffoWebhookService(dependencies: {
  verifyAndNormalize(rawBody: string, signature: string | null): NormalizedWaffoWebhook;
  repository: WebhookRepository;
}): {
  ingest(rawBody: string, signature: string | null): Promise<{
    disposition: "processed" | "accepted" | "dead_letter";
    duplicate: "delivery" | "event" | null;
    outcome: string;
  }>;
} {
  return {
    async ingest(rawBody, signature) {
      const event = dependencies.verifyAndNormalize(rawBody, signature);
      const recorded = await dependencies.repository.recordVerifiedEvent(event);
      try {
        const result = await dependencies.repository.processInbox(recorded.inboxId);
        return {
          disposition: result.outcome === "pending_order" ? "accepted" : "processed",
          duplicate: recorded.duplicate,
          outcome: result.outcome,
        };
      } catch {
        const failure = await dependencies.repository.recordProcessingFailure(
          recorded.inboxId,
          "PAYMENT_PROCESSING_FAILURE",
        );
        if (failure.deadLetter) {
          return {
            disposition: "dead_letter",
            duplicate: recorded.duplicate,
            outcome: "dead_letter",
          };
        }
        throw new WebhookServiceError("WEBHOOK_PROCESSING_UNAVAILABLE", true);
      }
    },
  };
}
