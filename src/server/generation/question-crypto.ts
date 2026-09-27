import { decryptJsonWithKeyMaterial, encryptJsonWithKeyMaterial } from "@/lib/crypto";

type Row = Record<string, unknown>;

type VersionedKey = { version: string; material: string };

function parseQuestionKeys(raw: string | undefined): VersionedKey[] {
  if (!raw?.trim()) return [];
  return raw.split(",").map((entry) => {
    const match = /^([A-Za-z0-9][A-Za-z0-9._-]*):(.+)$/.exec(entry.trim());
    if (!match || !match[2].trim()) throw new Error("QUESTION_KEY_UNAVAILABLE");
    return { version: match[1], material: match[2].trim() };
  });
}

export function getActiveQuestionFingerprintKey(
  env: Record<string, string | undefined> = process.env,
): VersionedKey {
  const key = parseQuestionKeys(env.QUESTION_FINGERPRINT_KEYS)[0];
  if (!key) throw new Error("QUESTION_FINGERPRINT_KEY_UNAVAILABLE");
  return key;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? value : null;
}

export function decryptQuestionForGeneration(
  row: Row,
  env: Record<string, string | undefined> = process.env,
): string {
  if (row.question_version_id == null) throw new Error("CORE_QUESTION_REQUIRED");

  const castingId = nonEmptyString(row.id);
  const questionVersionId = nonEmptyString(row.question_version_id);
  const ciphertext = nonEmptyString(row.question_ciphertext);
  const iv = nonEmptyString(row.question_iv);
  const tag = nonEmptyString(row.question_auth_tag);
  const version = nonEmptyString(row.question_encryption_key_version);

  if (!castingId || !questionVersionId || !ciphertext || !iv || !tag || !version) {
    throw new Error("QUESTION_DECRYPT_FAILED");
  }

  const key = parseQuestionKeys(env.QUESTION_ENCRYPTION_KEYS)
    .find((candidate) => candidate.version === version);
  if (!key) throw new Error("QUESTION_KEY_UNAVAILABLE");

  try {
    const payload = decryptJsonWithKeyMaterial<{ context?: unknown }>(
      { v: version, iv, tag, data: ciphertext },
      "context",
      key.material,
      `${castingId}:${questionVersionId}`,
    );
    const context = nonEmptyString(payload?.context);
    if (!context) throw new Error("QUESTION_DECRYPT_FAILED");
    return context;
  } catch (error) {
    if (error instanceof Error && error.message === "QUESTION_DECRYPT_FAILED") throw error;
    throw new Error("QUESTION_DECRYPT_FAILED");
  }
}

export function encryptQuestionForStorage(
  input: {
    castingId: string;
    questionVersionId: string;
    question: string;
  },
  env: Record<string, string | undefined> = process.env,
): {
  ciphertext: string;
  iv: string;
  authTag: string;
  encryptionKeyVersion: string;
} {
  const keys = parseQuestionKeys(env.QUESTION_ENCRYPTION_KEYS);
  const activeKey = keys[0];
  if (!activeKey) throw new Error("QUESTION_KEY_UNAVAILABLE");

  const encrypted = encryptJsonWithKeyMaterial(
    { context: input.question },
    "context",
    activeKey.version,
    activeKey.material,
    `${input.castingId}:${input.questionVersionId}`,
  );

  return {
    ciphertext: encrypted.data,
    iv: encrypted.iv,
    authTag: encrypted.tag,
    encryptionKeyVersion: encrypted.v,
  };
}
