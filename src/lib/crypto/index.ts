import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import {
  decodeVersionedKeyValue,
  resolveVersionedKey,
  resolveWriteKey,
  runtimeConfig,
  type RuntimeKeys,
  type VersionedKeySet,
} from "@/server/config";

// Server-only crypto. Never imported by client components.
// Key material comes only from validated, purpose-separated runtime keyrings.

type CryptoPurpose = "context" | "question" | "result" | "cookie" | "anon";
type RuntimeKeyPurpose = keyof RuntimeKeys;

const PURPOSE_KEYS: Record<CryptoPurpose, RuntimeKeyPurpose> = {
  context: "questionEncryption",
  question: "questionFingerprint",
  result: "resultIntegrity",
  cookie: "sessionSigning",
  anon: "sessionSigning",
};

function keySetForPurpose(purpose: CryptoPurpose): VersionedKeySet {
  return runtimeConfig().keys[PURPOSE_KEYS[purpose]];
}

function deriveKey(purpose: CryptoPurpose, version?: string, length = 32): { key: Buffer; version: string } {
  const keySet = keySetForPurpose(purpose);
  const resolved = version ? resolveVersionedKey(keySet, version) : resolveWriteKey(keySet);
  const rootMaterial = decodeVersionedKeyValue(resolved.value);
  const derivationInput = Buffer.concat([
    Buffer.from(`${purpose}:${resolved.version}:`, "utf8"),
    rootMaterial,
  ]);
  return {
    key: scryptSync(
      derivationInput,
      `iching-coin-${purpose}-v2`,
      length,
    ),
    version: resolved.version,
  };
}

function b64(buf: Buffer): string {
  return buf.toString("base64url");
}
function fromB64(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

// ---- AES-256-GCM for sensitive question context & generation snapshots (§17.2) ----
export type EncryptedBlob = {
  v: string;
  iv: string;
  tag: string;
  data: string;
};

export function encryptJson(
  value: unknown,
  purpose: "context" = "context",
  version?: string,
  aad?: string,
): EncryptedBlob {
  const derived = deriveKey(purpose, version);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derived.key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"));
  const json = JSON.stringify(value);
  const enc = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { v: derived.version, iv: b64(iv), tag: b64(tag), data: b64(enc) };
}

export function decryptJson<T = unknown>(
  blob: EncryptedBlob,
  purpose: "context" = "context",
  aad?: string,
): T {
  const { key } = deriveKey(purpose, blob.v);
  const decipher = createDecipheriv("aes-256-gcm", key, fromB64(blob.iv));
  if (aad) decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(fromB64(blob.tag));
  const dec = Buffer.concat([decipher.update(fromB64(blob.data)), decipher.final()]);
  return JSON.parse(dec.toString("utf8")) as T;
}

// ---- Versioned HMAC for fingerprints, result audit, anonymous session (§17.2) ----
export function hmac(
  value: string,
  purpose: Exclude<CryptoPurpose, "context">,
  version?: string,
): string {
  const { key } = deriveKey(purpose, version);
  return b64(createHmac("sha256", key).update(value).digest());
}

export function randomToken(bytes = 32): string {
  return b64(randomBytes(bytes));
}

// Signed cookie value: keyVersion.payload.signature. Verification uses only the encoded key version.
export function signCookie(payload: string): string {
  const keySet = keySetForPurpose("cookie");
  const version = keySet.writeVersion;
  const sig = hmac(`${version}.${payload}`, "cookie", version);
  return `${version}.${payload}.${sig}`;
}

export function verifyCookie(signed: string): string | null {
  const firstDot = signed.indexOf(".");
  const lastDot = signed.lastIndexOf(".");
  if (firstDot <= 0 || lastDot <= firstDot) return null;
  const version = signed.slice(0, firstDot);
  const payload = signed.slice(firstDot + 1, lastDot);
  const sig = signed.slice(lastDot + 1);
  let expected: string;
  try {
    expected = hmac(`${version}.${payload}`, "cookie", version);
  } catch {
    return null;
  }
  const actualBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  return timingSafeEqual(actualBuffer, expectedBuffer) ? payload : null;
}
