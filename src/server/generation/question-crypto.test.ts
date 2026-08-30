import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { encryptJsonWithKeyMaterial } from "@/lib/crypto";
import {
  decryptQuestionForGeneration,
  encryptQuestionForStorage,
  fingerprintQuestion,
} from "./question-crypto";

const AAD = "casting-1:qv-1";

function encryptedRow(keyMaterial = "question-secret") {
  const encrypted = encryptJsonWithKeyMaterial(
    { context: "Should I accept the new role?" },
    "context",
    "v2",
    keyMaterial,
    AAD,
  );
  return {
    id: "casting-1",
    question_version_id: "qv-1",
    question_ciphertext: encrypted.data,
    question_iv: encrypted.iv,
    question_auth_tag: encrypted.tag,
    question_encryption_key_version: encrypted.v,
    scene: "career",
  };
}

describe("decryptQuestionForGeneration", () => {
  it("decrypts a real encrypted question using the configured versioned key", () => {
    expect(decryptQuestionForGeneration(encryptedRow(), {
      QUESTION_ENCRYPTION_KEYS: "v2:question-secret,v1:old-secret",
    })).toBe("Should I accept the new role?");
  });

  it("keeps the legitimate no-question path separate from encrypted-question failure", () => {
    expect(decryptQuestionForGeneration({
      id: "casting-1",
      question_version_id: null,
      question_ciphertext: null,
      question_iv: null,
      question_auth_tag: null,
      question_encryption_key_version: null,
      scene: "career",
    }, {})).toBe("Reading for scene: career");
  });

  it("fails closed when an encrypted question is missing ciphertext", () => {
    expect(() => decryptQuestionForGeneration({
      ...encryptedRow(),
      question_ciphertext: null,
    }, { QUESTION_ENCRYPTION_KEYS: "v2:question-secret" })).toThrowError("QUESTION_DECRYPT_FAILED");
  });

  it("fails closed when the configured key version is unavailable", () => {
    expect(() => decryptQuestionForGeneration(encryptedRow(), {
      QUESTION_ENCRYPTION_KEYS: "v1:old-secret",
    })).toThrowError("QUESTION_KEY_UNAVAILABLE");
  });

  it("fails closed when AES-GCM authentication fails", () => {
    expect(() => decryptQuestionForGeneration(encryptedRow(), {
      QUESTION_ENCRYPTION_KEYS: "v2:wrong-secret",
    })).toThrowError("QUESTION_DECRYPT_FAILED");
  });
});

const V1 = "v1:question-encryption-material-000000000001";
const V2 = "v2:question-encryption-material-000000000002";
const FP1 = "v1:question-fingerprint-material-00000001";
const FP2 = "v2:question-fingerprint-material-00000002";

function env(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return { QUESTION_ENCRYPTION_KEYS: V1, QUESTION_FINGERPRINT_KEYS: FP1, ...overrides };
}

/** Shape the encrypted columns the way decryptQuestionForGeneration reads them. */
function storedRow(
  castingId: string,
  questionVersionId: string,
  encrypted: ReturnType<typeof encryptQuestionForStorage>,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: castingId,
    question_version_id: questionVersionId,
    question_ciphertext: encrypted.ciphertext,
    question_iv: encrypted.iv,
    question_auth_tag: encrypted.authTag,
    question_encryption_key_version: encrypted.encryptionKeyVersion,
    ...extra,
  };
}

describe("question encryption round trip", () => {
  it("decrypts back to the original question", () => {
    const castingId = randomUUID();
    const questionVersionId = randomUUID();
    const question = "Should I accept the offer in Berlin?";

    const encrypted = encryptQuestionForStorage(question, castingId, questionVersionId, env());

    expect(encrypted.ciphertext).not.toContain("Berlin");
    expect(decryptQuestionForGeneration(storedRow(castingId, questionVersionId, encrypted), env()))
      .toBe(question);
  });

  it("round trips non-ASCII questions unchanged", () => {
    const castingId = randomUUID();
    const questionVersionId = randomUUID();
    const question = "我该接受这份工作吗？";

    const encrypted = encryptQuestionForStorage(question, castingId, questionVersionId, env());

    expect(decryptQuestionForGeneration(storedRow(castingId, questionVersionId, encrypted), env()))
      .toBe(question);
  });

  it("produces a distinct ciphertext per call for the same question", () => {
    const castingId = randomUUID();
    const questionVersionId = randomUUID();

    const first = encryptQuestionForStorage("Same question", castingId, questionVersionId, env());
    const second = encryptQuestionForStorage("Same question", castingId, questionVersionId, env());

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("encrypts with the first key in the set", () => {
    const encrypted = encryptQuestionForStorage(
      "Which key signed this?",
      randomUUID(),
      randomUUID(),
      env({ QUESTION_ENCRYPTION_KEYS: `${V2},${V1}` }),
    );

    expect(encrypted.encryptionKeyVersion).toBe("v2");
  });

  it("refuses to encrypt when no key is configured", () => {
    expect(() => encryptQuestionForStorage(
      "No keys",
      randomUUID(),
      randomUUID(),
      env({ QUESTION_ENCRYPTION_KEYS: "" }),
    )).toThrow("QUESTION_KEY_UNAVAILABLE");
  });

  it("refuses to encrypt a blank question", () => {
    expect(() => encryptQuestionForStorage("   ", randomUUID(), randomUUID(), env()))
      .toThrow("QUESTION_ENCRYPT_FAILED");
  });
});

describe("question encryption key rotation", () => {
  it("decrypts a v1 blob after v2 becomes the active key", () => {
    const castingId = randomUUID();
    const questionVersionId = randomUUID();
    const question = "Written before the rotation";

    const encrypted = encryptQuestionForStorage(
      question,
      castingId,
      questionVersionId,
      env({ QUESTION_ENCRYPTION_KEYS: V1 }),
    );
    expect(encrypted.encryptionKeyVersion).toBe("v1");

    // After rotation both keys are present and v2 leads.
    const rotated = env({ QUESTION_ENCRYPTION_KEYS: `${V2},${V1}` });
    expect(decryptQuestionForGeneration(storedRow(castingId, questionVersionId, encrypted), rotated))
      .toBe(question);

    const reEncrypted = encryptQuestionForStorage(question, castingId, questionVersionId, rotated);
    expect(reEncrypted.encryptionKeyVersion).toBe("v2");
    expect(decryptQuestionForGeneration(storedRow(castingId, questionVersionId, reEncrypted), rotated))
      .toBe(question);
  });

  it("fails closed once the writing key is retired", () => {
    const castingId = randomUUID();
    const questionVersionId = randomUUID();

    const encrypted = encryptQuestionForStorage(
      "Written under v1",
      castingId,
      questionVersionId,
      env({ QUESTION_ENCRYPTION_KEYS: V1 }),
    );

    expect(() => decryptQuestionForGeneration(
      storedRow(castingId, questionVersionId, encrypted),
      env({ QUESTION_ENCRYPTION_KEYS: V2 }),
    )).toThrow("QUESTION_KEY_UNAVAILABLE");
  });
});

describe("question encryption additional authenticated data", () => {
  it("rejects a blob replayed under a different casting id", () => {
    const questionVersionId = randomUUID();
    const encrypted = encryptQuestionForStorage("Bound to a row", randomUUID(), questionVersionId, env());

    expect(() => decryptQuestionForGeneration(
      storedRow(randomUUID(), questionVersionId, encrypted),
      env(),
    )).toThrow("QUESTION_DECRYPT_FAILED");
  });

  it("rejects a blob replayed under a different question version", () => {
    const castingId = randomUUID();
    const encrypted = encryptQuestionForStorage("Bound to a row", castingId, randomUUID(), env());

    expect(() => decryptQuestionForGeneration(
      storedRow(castingId, randomUUID(), encrypted),
      env(),
    )).toThrow("QUESTION_DECRYPT_FAILED");
  });

  it("rejects a tampered auth tag", () => {
    const castingId = randomUUID();
    const questionVersionId = randomUUID();
    const encrypted = encryptQuestionForStorage("Bound to a row", castingId, questionVersionId, env());

    expect(() => decryptQuestionForGeneration(
      storedRow(castingId, questionVersionId, {
        ...encrypted,
        authTag: Buffer.from("0".repeat(16)).toString("base64url"),
      }),
      env(),
    )).toThrow("QUESTION_DECRYPT_FAILED");
  });
});

describe("question fingerprint", () => {
  it("is stable for the same question", () => {
    const first = fingerprintQuestion("Should I move?", env());
    const second = fingerprintQuestion("Should I move?", env());

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.fingerprintKeyVersion).toBe("v1");
  });

  it("ignores surrounding and repeated whitespace", () => {
    const canonical = fingerprintQuestion("Should I move?", env()).fingerprint;

    expect(fingerprintQuestion("  Should I move?  ", env()).fingerprint).toBe(canonical);
    expect(fingerprintQuestion("Should  I\tmove?", env()).fingerprint).toBe(canonical);
  });

  it("normalises unicode width", () => {
    // NFKC folds fullwidth latin onto ASCII.
    expect(fingerprintQuestion("ＡＢＣ", env()).fingerprint)
      .toBe(fingerprintQuestion("ABC", env()).fingerprint);
  });

  it("differs for different questions", () => {
    expect(fingerprintQuestion("Should I move?", env()).fingerprint)
      .not.toBe(fingerprintQuestion("Should I stay?", env()).fingerprint);
  });

  it("does not leak the question", () => {
    expect(fingerprintQuestion("Berlin", env()).fingerprint).not.toContain("Berlin");
  });

  it("is keyed — a different key set yields a different fingerprint", () => {
    expect(fingerprintQuestion("Should I move?", env({ QUESTION_FINGERPRINT_KEYS: FP1 })).fingerprint)
      .not.toBe(fingerprintQuestion("Should I move?", env({ QUESTION_FINGERPRINT_KEYS: FP2 })).fingerprint);
  });

  it("fingerprints with the first key and keeps the old one reproducible", () => {
    const beforeRotation = fingerprintQuestion("Should I move?", env({ QUESTION_FINGERPRINT_KEYS: FP1 }));
    const afterRotation = fingerprintQuestion("Should I move?", env({ QUESTION_FINGERPRINT_KEYS: `${FP2},${FP1}` }));

    expect(beforeRotation.fingerprintKeyVersion).toBe("v1");
    expect(afterRotation.fingerprintKeyVersion).toBe("v2");
    expect(afterRotation.fingerprint).not.toBe(beforeRotation.fingerprint);

    // A stored v1 fingerprint stays recomputable while its key remains in the set.
    const recomputed = fingerprintQuestion("Should I move?", env({ QUESTION_FINGERPRINT_KEYS: FP1 }));
    expect(recomputed.fingerprint).toBe(beforeRotation.fingerprint);
  });

  it("refuses to fingerprint when no key is configured", () => {
    expect(() => fingerprintQuestion("Should I move?", env({ QUESTION_FINGERPRINT_KEYS: "" })))
      .toThrow("QUESTION_FINGERPRINT_KEY_UNAVAILABLE");
  });

  it("refuses to fingerprint a blank question", () => {
    expect(() => fingerprintQuestion("   ", env())).toThrow("QUESTION_FINGERPRINT_FAILED");
  });
});
