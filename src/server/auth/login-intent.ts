import { createHmac, timingSafeEqual } from "node:crypto";
import type { VersionedKey, VersionedKeySet } from "@/server/config";
import { DomainError } from "@/server/errors/domain-error";

export function assertAllowedCallbackPath(path: string): string {
  const normalized = path.trim();
  if (
    !normalized.startsWith("/")
    || normalized.startsWith("//")
    || normalized.includes("\\")
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new DomainError(
      "LOGIN_INTENT_CALLBACK_INVALID",
      "The sign-in return path is not allowed.",
      false,
      "callbackPath",
    );
  }
  return normalized;
}

export function hashLoginIntentNonce(nonce: string, key: VersionedKey): string {
  return createHmac("sha256", key.value)
    .update(`login-intent:${key.version}:${nonce}`)
    .digest("base64url");
}

export function nonceMatches(
  storedHash: string,
  storedKeyVersion: string,
  nonce: string,
  keys: VersionedKeySet,
): boolean {
  const key = keys.read.find((candidate) => candidate.version === storedKeyVersion);
  if (!key) return false;
  const expected = Buffer.from(hashLoginIntentNonce(nonce, key));
  const actual = Buffer.from(storedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
