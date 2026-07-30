import { createHmac, timingSafeEqual } from "node:crypto";
import type { VersionedKey, VersionedKeySet } from "@/server/config";
import { DomainError } from "@/server/errors/domain-error";

const HANDOFF_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,512}$/;

function safeEqual(left: string, right: string): boolean {
  const actual = Buffer.from(left, "utf8");
  const expected = Buffer.from(right, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function normalizeLoginEmail(email: string): string {
  return email.normalize("NFKC").trim().toLowerCase();
}

function handoffSignature(token: string, key: VersionedKey): string {
  return createHmac("sha256", key.value)
    .update(`login-handoff-state:${key.version}:${token}`)
    .digest("base64url");
}

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
  return safeEqual(storedHash, hashLoginIntentNonce(nonce, key));
}

export function createLoginHandoffState(token: string, key: VersionedKey): string {
  if (!HANDOFF_TOKEN_PATTERN.test(token)) {
    throw new DomainError("LOGIN_INTENT_INVALID", "This sign-in link is invalid.", false);
  }
  return `${key.version}.${token}.${handoffSignature(token, key)}`;
}

export function verifyLoginHandoffState(
  state: string,
  keys: VersionedKeySet,
): { token: string; keyVersion: string } | null {
  const firstDot = state.indexOf(".");
  const lastDot = state.lastIndexOf(".");
  if (firstDot <= 0 || lastDot <= firstDot) return null;
  const keyVersion = state.slice(0, firstDot);
  const token = state.slice(firstDot + 1, lastDot);
  const signature = state.slice(lastDot + 1);
  if (!HANDOFF_TOKEN_PATTERN.test(token) || !signature) return null;
  const key = keys.read.find((candidate) => candidate.version === keyVersion);
  if (!key) return null;
  return safeEqual(signature, handoffSignature(token, key))
    ? { token, keyVersion }
    : null;
}

export function hashLoginExpectedEmail(email: string, key: VersionedKey): string {
  const normalized = normalizeLoginEmail(email);
  if (!normalized) {
    throw new DomainError("LOGIN_INTENT_EMAIL_INVALID", "A sign-in email is required.", false, "email");
  }
  return createHmac("sha256", key.value)
    .update(`login-intent-email:${key.version}:${normalized}`)
    .digest("base64url");
}

export function emailMatches(
  storedHash: string,
  storedKeyVersion: string,
  authenticatedEmail: string,
  keys: VersionedKeySet,
): boolean {
  const key = keys.read.find((candidate) => candidate.version === storedKeyVersion);
  if (!key) return false;
  try {
    return safeEqual(storedHash, hashLoginExpectedEmail(authenticatedEmail, key));
  } catch {
    return false;
  }
}
