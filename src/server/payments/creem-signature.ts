import { createHmac, timingSafeEqual } from "node:crypto";

const SHA256_HEX_LENGTH = 64;

export function verifyCreemSignature(
  rawBody: string,
  signature: string | null | undefined,
  webhookSecret: string,
): boolean {
  if (!signature || !/^[0-9a-fA-F]{64}$/.test(signature) || signature.length !== SHA256_HEX_LENGTH) {
    return false;
  }
  if (!webhookSecret) return false;

  const expected = createHmac("sha256", webhookSecret).update(rawBody, "utf8").digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}
