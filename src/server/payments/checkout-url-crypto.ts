import type { EncryptedBlob } from "@/lib/crypto";
import { decryptJsonWithKeyMaterial, encryptJsonWithKeyMaterial } from "@/lib/crypto";

const STORAGE_PREFIX = "enc:v1:";
const PURPOSE = "payment-checkout-url";

type CheckoutUrlKey = { version: string; material: string };

function keyring(rawKeys: string): CheckoutUrlKey[] {
  const raw = rawKeys?.trim();
  if (!raw) throw new Error("PAYMENT_CHECKOUT_URL_KEYS_INVALID");
  const versions = new Set<string>();
  const materials = new Set<string>();
  const keys: CheckoutUrlKey[] = [];
  for (const entry of raw.split(",")) {
    const match = /^([A-Za-z0-9][A-Za-z0-9._-]*):(.+)$/.exec(entry.trim());
    const material = match?.[2]?.trim();
    if (!match || !material || versions.has(match[1]) || materials.has(material)) {
      throw new Error("PAYMENT_CHECKOUT_URL_KEYS_INVALID");
    }
    versions.add(match[1]);
    materials.add(material);
    keys.push({ version: match[1], material });
  }
  if (!keys[0]) throw new Error("PAYMENT_CHECKOUT_URL_KEYS_INVALID");
  return keys;
}

export function encryptCheckoutUrl(url: string, orderId: string, rawKeys: string): string {
  if (!url.trim() || !orderId.trim()) throw new Error("PAYMENT_CHECKOUT_URL_INVALID");
  const currentKey = keyring(rawKeys)[0]!;
  const blob = encryptJsonWithKeyMaterial(
    { url },
    PURPOSE,
    currentKey.version,
    currentKey.material,
    orderId,
  );
  return `${STORAGE_PREFIX}${JSON.stringify(blob)}`;
}

export function decryptCheckoutUrl(
  stored: string | null | undefined,
  orderId: string,
  rawKeys: string,
): string | null {
  if (!stored?.startsWith(STORAGE_PREFIX) || !orderId.trim()) return null;
  try {
    const blob = JSON.parse(stored.slice(STORAGE_PREFIX.length)) as EncryptedBlob;
    const key = keyring(rawKeys).find((candidate) => candidate.version === blob.v);
    if (!key) return null;
    const value = decryptJsonWithKeyMaterial<{ url?: unknown }>(
      blob,
      PURPOSE,
      key.material,
      orderId,
    );
    return typeof value.url === "string" && value.url.trim() ? value.url : null;
  } catch {
    return null;
  }
}
