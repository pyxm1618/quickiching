import { decryptJsonWithKeyMaterial, encryptJsonWithKeyMaterial, hmacWithKeyMaterial } from "@/lib/crypto";

type Row = Record<string, unknown>;

type VersionedKey = { version: string; material: string };

// AES-GCM purpose label. Must stay "context" on both sides: the payload shape
// `{ context }` and this label are what decryptQuestionForGeneration expects.
const ENCRYPTION_PURPOSE = "context";
const FINGERPRINT_PURPOSE = "question-fingerprint";

function parseQuestionKeys(raw: string | undefined): VersionedKey[] {
  if (!raw?.trim()) return [];
  return raw.split(",").map((entry) => {
    const match = /^([A-Za-z0-9][A-Za-z0-9._-]*):(.+)$/.exec(entry.trim());
    if (!match || !match[2].trim()) throw new Error("QUESTION_KEY_UNAVAILABLE");
    return { version: match[1], material: match[2].trim() };
  });
}

function parseFingerprintKeys(raw: string | undefined): VersionedKey[] {
  if (!raw?.trim()) return [];
  return raw.split(",").map((entry) => {
    const match = /^([A-Za-z0-9][A-Za-z0-9._-]*):(.+)$/.exec(entry.trim());
    if (!match || !match[2].trim()) throw new Error("QUESTION_FINGERPRINT_KEY_UNAVAILABLE");
    return { version: match[1], material: match[2].trim() };
  });
}

/**
 * The AAD that binds a ciphertext to the row pair it belongs to. Reusing a
 * blob under a different casting or question version fails authentication.
 */
function questionAad(castingId: string, questionVersionId: string): string {
  return `${castingId}:${questionVersionId}`;
}

export type EncryptedQuestion = {
  ciphertext: string;
  iv: string;
  authTag: string;
  encryptionKeyVersion: string;
};

/**
 * Encrypt a question for `question_versions`. The first entry of
 * QUESTION_ENCRYPTION_KEYS is the active key — the same "newest first"
 * convention the checkout URL and result integrity keyrings use — while
 * decryption still accepts every version in the set, so a rotation can add a
 * key without rewriting stored rows.
 */
export function encryptQuestionForStorage(
  question: string,
  castingId: string,
  questionVersionId: string,
  env: Record<string, string | undefined> = process.env,
): EncryptedQuestion {
  const context = question.trim();
  if (!context) throw new Error("QUESTION_ENCRYPT_FAILED");
  if (!castingId.trim() || !questionVersionId.trim()) throw new Error("QUESTION_ENCRYPT_FAILED");

  const key = parseQuestionKeys(env.QUESTION_ENCRYPTION_KEYS)[0];
  if (!key) throw new Error("QUESTION_KEY_UNAVAILABLE");

  const blob = encryptJsonWithKeyMaterial(
    { context },
    ENCRYPTION_PURPOSE,
    key.version,
    key.material,
    questionAad(castingId, questionVersionId),
  );
  return {
    ciphertext: blob.data,
    iv: blob.iv,
    authTag: blob.tag,
    encryptionKeyVersion: blob.v,
  };
}

/**
 * Normalise before fingerprinting so that the same question typed with
 * different spacing or unicode width produces the same fingerprint. Case is
 * deliberately preserved: lowercasing is locale-dependent and buys nothing for
 * the short-window duplicate detection this fingerprint serves.
 */
function normalizeQuestion(question: string): string {
  return question.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export type QuestionFingerprint = {
  fingerprint: string;
  fingerprintKeyVersion: string;
};

/**
 * Keyed fingerprint for `casting_sessions.question_fingerprint` and
 * `question_versions.fingerprint`. Keyed rather than a bare hash so that
 * possession of the database alone does not allow confirming a guessed
 * question.
 */
export function fingerprintQuestion(
  question: string,
  env: Record<string, string | undefined> = process.env,
): QuestionFingerprint {
  const normalized = normalizeQuestion(question);
  if (!normalized) throw new Error("QUESTION_FINGERPRINT_FAILED");

  const key = parseFingerprintKeys(env.QUESTION_FINGERPRINT_KEYS)[0];
  if (!key) throw new Error("QUESTION_FINGERPRINT_KEY_UNAVAILABLE");

  return {
    fingerprint: hmacWithKeyMaterial(normalized, FINGERPRINT_PURPOSE, key.version, key.material),
    fingerprintKeyVersion: key.version,
  };
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? value : null;
}

function noQuestionFallback(row: Row): string {
  const scene = nonEmptyString(row.scene);
  return scene ? `Reading for scene: ${scene}` : "General I Ching Reading";
}

export function decryptQuestionForGeneration(
  row: Row,
  env: Record<string, string | undefined> = process.env,
): string {
  if (row.question_version_id == null) return noQuestionFallback(row);

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
      ENCRYPTION_PURPOSE,
      key.material,
      questionAad(castingId, questionVersionId),
    );
    const context = nonEmptyString(payload?.context);
    if (!context) throw new Error("QUESTION_DECRYPT_FAILED");
    return context;
  } catch (error) {
    if (error instanceof Error && error.message === "QUESTION_DECRYPT_FAILED") throw error;
    throw new Error("QUESTION_DECRYPT_FAILED");
  }
}
