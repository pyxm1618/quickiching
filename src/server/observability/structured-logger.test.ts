import { describe, expect, it, vi } from "vitest";
import { createStructuredLogger } from "./structured-logger";

describe("structured logger", () => {
  it("keeps safe operational dimensions and redacts sensitive content recursively", () => {
    const sink = vi.fn();
    const logger = createStructuredLogger({ sink, environment: "test" });

    logger.error("generation_failed", {
      requestId: "req_1",
      jobId: "job_1",
      castingId: "cas_1",
      generationEpoch: 2,
      email: "person@example.com",
      context: "My private question text",
      prompt: "full prompt",
      token: "magic-token",
      authorization: "Bearer secret",
      nested: { question: "private", providerRequestId: "provider_1" },
      error: new Error("DATABASE_URL=postgres://secret"),
    });

    expect(sink).toHaveBeenCalledTimes(1);
    const [entry] = sink.mock.calls[0];
    expect(entry).toMatchObject({
      level: "error",
      event: "generation_failed",
      environment: "test",
      requestId: "req_1",
      jobId: "job_1",
      castingId: "cas_1",
      generationEpoch: 2,
      nested: { question: "[REDACTED]", providerRequestId: "provider_1" },
    });
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain("person@example.com");
    expect(serialized).not.toContain("private question");
    expect(serialized).not.toContain("full prompt");
    expect(serialized).not.toContain("magic-token");
    expect(serialized).not.toContain("postgres://secret");
  });
});
