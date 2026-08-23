import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

// Server-only crypto. Never imported by client components.
// Purpose isolation per technical-design §17.2: different keys for fingerprint, HMAC result,
// anonymous session, and question/context encryption.

function deriveKey(purpose: string, version: string, length = 32): Buffer {
  const secret = process.env.APP_SECRET ?? "dev-only-not-secret-change-me";
  return scryptSync(`${purpose}:${version}:${secret}`, "iching-coin-salt", length);
}

function b64(buf: Buffer): string {
  return buf.toString("base64url");
}
function fromB64(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

// ---- AES-256-GCM for sensitive question context & generation snapshots (§17.2) ----
export type EncryptedBlob = {
  v: string; // key version
  iv: string;
  tag: string;
  data: string;
};

export function encryptJson(value: unknown, purpose = "context", version = "v1", aad?: string): EncryptedBlob {
  const key = deriveKey(purpose, version);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"));
  const json = JSON.stringify(value);
  const enc = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { v: version, iv: b64(iv), tag: b64(tag), data: b64(enc) };
}

export function decryptJson<T = unknown>(blob: EncryptedBlob, purpose = "context", aad?: string): T {
  const key = deriveKey(purpose, blob.v);
  const decipher = createDecipheriv("aes-256-gcm", key, fromB64(blob.iv));
  if (aad) decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(fromB64(blob.tag));
  const dec = Buffer.concat([decipher.update(fromB64(blob.data)), decipher.final()]);
  return JSON.parse(dec.toString("utf8")) as T;
}

// ---- Versioned HMAC for fingerprints, result audit, anonymous session (§17.2) ----
export function hmac(value: string, purpose: string, version = "v1"): string {
  const key = deriveKey(purpose, version);
  return b64(createHmac("sha256", key).update(value).digest());
}

export function hmacWithKeyMaterial(
  value: string,
  purpose: string,
  version: string,
  keyMaterial: string,
): string {
  const key = scryptSync(`${purpose}:${version}:${keyMaterial}`, "iching-coin-salt", 32);
  return b64(createHmac("sha256", key).update(value).digest());
}

export function verifyHmacWithKeyMaterial(
  value: string,
  signature: string,
  purpose: string,
  version: string,
  keyMaterial: string,
): boolean {
  const expected = Buffer.from(hmacWithKeyMaterial(value, purpose, version, keyMaterial));
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function randomToken(bytes = 32): string {
  return b64(randomBytes(bytes));
}

// Signed cookie value: payload.signature (HMAC over payload with a nonce).
export function signCookie(payload: string): string {
  const sig = hmac(payload, "cookie");
  return `${payload}.${sig}`;
}

export function verifyCookie(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx < 0) return null;
  const payload = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = hmac(payload, "cookie");
  // constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !a.equals(b)) return null;
  return payload;
}
