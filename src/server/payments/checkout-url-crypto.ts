import type { EncryptedBlob } from "@/lib/crypto";
import { decryptJsonWithKeyMaterial, encryptJsonWithKeyMaterial } from "@/lib/crypto";

const STORAGE_PREFIX = "enc:v1:";
const PURPOSE = "payment-checkout-url";
const VERSION = "v1";

function keyMaterial(): string {
  const secret = process.env.APP_SECRET?.trim();
  if (!secret) throw new Error("PAYMENT_CHECKOUT_URL_KEY_UNAVAILABLE");
  return secret;
}

export function encryptCheckoutUrl(url: string, orderId: string): string {
  if (!url.trim() || !orderId.trim()) throw new Error("PAYMENT_CHECKOUT_URL_INVALID");
  const blob = encryptJsonWithKeyMaterial(
    { url },
    PURPOSE,
    VERSION,
    keyMaterial(),
    orderId,
  );
  return `${STORAGE_PREFIX}${JSON.stringify(blob)}`;
}

export function decryptCheckoutUrl(stored: string | null | undefined, orderId: string): string | null {
  if (!stored?.startsWith(STORAGE_PREFIX) || !orderId.trim()) return null;
  try {
    const blob = JSON.parse(stored.slice(STORAGE_PREFIX.length)) as EncryptedBlob;
    const value = decryptJsonWithKeyMaterial<{ url?: unknown }>(
      blob,
      PURPOSE,
      keyMaterial(),
      orderId,
    );
    return typeof value.url === "string" && value.url.trim() ? value.url : null;
  } catch {
    return null;
  }
}
