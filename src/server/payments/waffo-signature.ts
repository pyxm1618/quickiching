import { createVerify } from "node:crypto";

const DEFAULT_TOLERANCE_MS = 5 * 60_000;

function parseSignatureHeader(value: string): { timestamp: number; signature: string } | null {
  const fields = new Map<string, string>();
  for (const part of value.split(",")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    fields.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  const timestampRaw = fields.get("t");
  const signature = fields.get("v1");
  if (!timestampRaw || !signature || !/^\d+$/.test(timestampRaw)) return null;
  const timestamp = Number(timestampRaw);
  if (!Number.isSafeInteger(timestamp)) return null;
  return { timestamp, signature };
}

export function verifyWaffoWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  publicKey: string;
  now?: Date;
  toleranceMs?: number;
}): boolean {
  if (!input.signatureHeader) return false;
  const parsed = parseSignatureHeader(input.signatureHeader);
  if (!parsed) return false;
  const now = input.now ?? new Date();
  const toleranceMs = input.toleranceMs ?? DEFAULT_TOLERANCE_MS;
  if (Math.abs(now.getTime() - parsed.timestamp) > toleranceMs) return false;
  let signature: Buffer;
  try {
    signature = Buffer.from(parsed.signature, "base64");
    if (signature.length === 0 || signature.toString("base64") !== parsed.signature) return false;
  } catch {
    return false;
  }
  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${parsed.timestamp}.${input.rawBody}`, "utf8");
    verifier.end();
    return verifier.verify(input.publicKey, signature);
  } catch {
    return false;
  }
}
