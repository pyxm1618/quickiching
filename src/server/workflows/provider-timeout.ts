export async function withAbortTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("AI_REQUEST_TIMEOUT_INVALID");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error("AI_REQUEST_TIMEOUT"));
  }, timeoutMs);

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("AI_REQUEST_TIMEOUT", { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
