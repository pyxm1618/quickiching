export class RequestBodyTooLargeError extends Error {
  constructor(readonly limitBytes: number) {
    super("REQUEST_BODY_TOO_LARGE");
    this.name = "RequestBodyTooLargeError";
  }
}

/** Read a request body with a byte ceiling and cancel the stream immediately when it is crossed. */
export async function readRequestBody(request: Request, limitBytes: number): Promise<string> {
  if (!Number.isSafeInteger(limitBytes) || limitBytes < 1) {
    throw new Error("REQUEST_BODY_LIMIT_INVALID");
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = result.value;
      totalBytes += chunk.byteLength;
      if (totalBytes > limitBytes) {
        await reader.cancel("REQUEST_BODY_TOO_LARGE");
        throw new RequestBodyTooLargeError(limitBytes);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
