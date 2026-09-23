export async function withAbortTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
  upstreamSignal?: AbortSignal,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("AI_REQUEST_TIMEOUT_INVALID");
  }

  const timeoutController = new AbortController();
  const effectiveSignal = upstreamSignal
    ? AbortSignal.any([upstreamSignal, timeoutController.signal])
    : timeoutController.signal;
  const timer = setTimeout(() => {
    timeoutController.abort(new Error("AI_REQUEST_TIMEOUT"));
  }, timeoutMs);

  try {
    return await operation(effectiveSignal);
  } catch (error) {
    if (timeoutController.signal.aborted) {
      throw new Error("AI_REQUEST_TIMEOUT", { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
