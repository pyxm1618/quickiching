import { beforeEach, describe, expect, it, vi } from "vitest";
import { WaffoWebhookError } from "@/server/payments/waffo-webhook";
import { WebhookServiceError } from "@/server/payments/webhook-service";

const mocks = vi.hoisted(() => ({
  enabled: true,
  createService: vi.fn(),
  ingest: vi.fn(),
}));
const MAX_TEST_WEBHOOK_BYTES = 64 * 1024;

vi.mock("@/server/payments/capability", () => ({
  isWebhookIngestionCapabilityEnabled: () => mocks.enabled,
}));
vi.mock("@/server/payments/composition", () => ({
  createProductionWaffoWebhookService: mocks.createService,
}));

import { GET, POST } from "./route";

function request(body = "{\"signed\":true}", headers: Record<string, string> = {}) {
  return new Request("https://www.quickiching.com/api/webhooks/waffo", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-waffo-signature": "signed-header",
      ...headers,
    },
    body,
  });
}

describe("CP4 Waffo webhook route", () => {
  beforeEach(() => {
    mocks.enabled = true;
    mocks.ingest.mockReset().mockResolvedValue({
      disposition: "accepted",
      duplicate: null,
      inboxId: "inbox-1",
    });
    mocks.createService.mockReset().mockResolvedValue({ ingest: mocks.ingest });
  });

  it("returns capability-off 404 before reading body or composing storage", async () => {
    mocks.enabled = false;
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("passes the exact raw body and signature without Auth or browser CSRF", async () => {
    const raw = "{ \"amount\": \"6.99\", \"buyer\": \"private\" }";
    const response = await POST(request(raw, { origin: "https://provider.waffo.example" }));
    expect(response.status).toBe(200);
    expect(mocks.ingest).toHaveBeenCalledWith(raw, "signed-header");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("rejects an oversized payload before composition", async () => {
    const response = await POST(request("x", { "content-length": String(65 * 1024) }));
    expect(response.status).toBe(413);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("maps signature and processing failures without echoing body, signature, or secrets", async () => {
    mocks.ingest.mockRejectedValue(new WaffoWebhookError("WEBHOOK_SIGNATURE_INVALID", false));
    const signatureFailure = await POST(request("private buyer payload"));
    expect(signatureFailure.status).toBe(401);
    const signatureBody = await signatureFailure.text();
    expect(signatureBody).not.toContain("private buyer");
    expect(signatureBody).not.toContain("signed-header");

    mocks.ingest.mockRejectedValue(new WebhookServiceError("WEBHOOK_PROCESSING_UNAVAILABLE", true));
    const transient = await POST(request("private buyer payload"));
    expect(transient.status).toBe(503);
    await expect(transient.json()).resolves.toEqual({ error: "WEBHOOK_PROCESSING_UNAVAILABLE", retryable: true });
  });

  it("acknowledges duplicate deliveries safely", async () => {
    mocks.ingest.mockResolvedValue({ disposition: "accepted", duplicate: "delivery", inboxId: "inbox-1" });
    expect((await POST(request())).status).toBe(200);
  });

  it("cancels a chunked body as soon as it crosses the byte limit without Content-Length", async () => {
    let cancelled = false;
    let sentOversizedChunk = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(MAX_TEST_WEBHOOK_BYTES - 4)));
      },
      pull(controller) {
        if (sentOversizedChunk) return;
        sentOversizedChunk = true;
        controller.enqueue(new TextEncoder().encode("oversized"));
        setTimeout(() => {
          if (!cancelled) controller.close();
        }, 50);
      },
      cancel() {
        cancelled = true;
      },
    });
    const response = await POST(new Request("https://www.quickiching.com/api/webhooks/waffo", {
      method: "POST",
      headers: { "content-type": "application/json", "x-waffo-signature": "signed-header" },
      body: stream,
      duplex: "half",
    } as RequestInit));
    expect(response.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("does not expose a GET webhook surface", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });
});
