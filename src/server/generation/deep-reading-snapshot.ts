import { decryptJsonWithKeyMaterial, encryptJsonWithKeyMaterial } from "@/lib/crypto";
import { deepReadingContextSnapshotSchema, type DeepReadingContextSnapshot } from "@/domain/generation/deep-reading-contract";

type VersionedKey = { version: string; material: string };

function parseKeys(raw: string | undefined): VersionedKey[] {
  if (!raw?.trim()) return [];
  return raw.split(",").map((entry) => {
    const match = /^([A-Za-z0-9][A-Za-z0-9._-]*):(.+)$/.exec(entry.trim());
    if (!match || !match[2].trim()) throw new Error("QUESTION_KEY_UNAVAILABLE");
    return { version: match[1], material: match[2].trim() };
  });
}

export type EncryptedDeepReadingSnapshot = {
  ciphertext: string;
  iv: string;
  authTag: string;
  encryptionKeyVersion: string;
};

export function encryptDeepReadingContextSnapshot(
  castingId: string,
  snapshot: DeepReadingContextSnapshot,
  env: Record<string, string | undefined> = process.env,
): EncryptedDeepReadingSnapshot {
  const activeKey = parseKeys(env.QUESTION_ENCRYPTION_KEYS)[0];
  if (!activeKey) throw new Error("QUESTION_KEY_UNAVAILABLE");

  const encrypted = encryptJsonWithKeyMaterial(
    snapshot,
    "deep-reading-context-snapshot",
    activeKey.version,
    activeKey.material,
    castingId,
  );
  return {
    ciphertext: encrypted.data,
    iv: encrypted.iv,
    authTag: encrypted.tag,
    encryptionKeyVersion: encrypted.v,
  };
}

export function decryptDeepReadingContextSnapshot(
  castingId: string,
  encrypted: EncryptedDeepReadingSnapshot,
  env: Record<string, string | undefined> = process.env,
): DeepReadingContextSnapshot {
  const key = parseKeys(env.QUESTION_ENCRYPTION_KEYS)
    .find((candidate) => candidate.version === encrypted.encryptionKeyVersion);
  if (!key) throw new Error("QUESTION_KEY_UNAVAILABLE");

  try {
    const value = decryptJsonWithKeyMaterial<unknown>(
      { v: encrypted.encryptionKeyVersion, iv: encrypted.iv, tag: encrypted.authTag, data: encrypted.ciphertext },
      "deep-reading-context-snapshot",
      key.material,
      castingId,
    );
    return deepReadingContextSnapshotSchema.parse(value);
  } catch (error) {
    if (error instanceof Error && error.message === "QUESTION_KEY_UNAVAILABLE") throw error;
    throw new Error("DEEP_READING_SNAPSHOT_INVALID");
  }
}
