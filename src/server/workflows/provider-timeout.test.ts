import { afterEach, describe, expect, it, vi } from "vitest";
import { withAbortTimeout } from "./provider-timeout";

describe("withAbortTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("actively aborts the provider signal when the deadline expires", async () => {
    vi.useFakeTimers();
    let observedSignal: AbortSignal | null = null;

    const pending = withAbortTimeout(1_000, async (signal) => {
      observedSignal = signal;
      return new Promise<string>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    });
    const rejection = expect(pending).rejects.toThrow("AI_REQUEST_TIMEOUT");

    await vi.advanceTimersByTimeAsync(1_000);

    expect(observedSignal?.aborted).toBe(true);
    await rejection;
  });

  it("clears the timeout after a successful provider call", async () => {
    vi.useFakeTimers();

    await expect(withAbortTimeout(1_000, async (signal) => {
      expect(signal.aborted).toBe(false);
      return "ok";
    })).resolves.toBe("ok");

    expect(vi.getTimerCount()).toBe(0);
  });
});
