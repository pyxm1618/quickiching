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
  constructor(
    readonly code: "WEBHOOK_PROCESSING_UNAVAILABLE" | "WEBHOOK_DEAD_LETTERED" | "WEBHOOK_SECURITY_CONFLICT",
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "WebhookServiceError";
  }
}

export function createWaffoWebhookService(dependencies: {
  verifyAndNormalize(rawBody: string, signature: string | null): NormalizedWaffoWebhook;
  repository: Pick<WebhookRepository, "recordVerifiedEvent">;
}): {
  ingest(rawBody: string, signature: string | null): Promise<{
    disposition: "accepted";
    duplicate: "delivery" | "event" | null;
    inboxId: string;
  }>;
} {
  return {
    async ingest(rawBody, signature) {
      const event = dependencies.verifyAndNormalize(rawBody, signature);
      let recorded: Awaited<ReturnType<WebhookRepository["recordVerifiedEvent"]>>;
      try {
        recorded = await dependencies.repository.recordVerifiedEvent(event);
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        if (
          code === "WEBHOOK_DELIVERY_CONFLICT"
          || code === "WEBHOOK_CANONICAL_PAYLOAD_CONFLICT"
          || code === "WEBHOOK_BUSINESS_EVENT_CONFLICT"
        ) {
          throw new WebhookServiceError("WEBHOOK_SECURITY_CONFLICT", false);
        }
        throw error;
      }

      return {
        disposition: "accepted",
        duplicate: recorded.duplicate,
        inboxId: recorded.inboxId,
      };
    },
  };
}
