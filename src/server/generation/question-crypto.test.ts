import { describe, expect, it } from "vitest";
import { encryptJsonWithKeyMaterial } from "@/lib/crypto";
import { decryptQuestionForGeneration } from "./question-crypto";

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
