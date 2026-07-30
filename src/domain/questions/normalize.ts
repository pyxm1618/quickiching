import { createHmac } from "node:crypto";
import type { InterpretationGoal, Scene } from "../casting/types";

// §10.1 Question normalization + fingerprint for the 72-hour same-question lock (CAST-004).
// Only case, Unicode compatibility form, whitespace and non-semantic punctuation differences
// are ignored. Semantic rewrites are explicitly NOT detected in MVP (per PRD §8.5).

// Approved non-semantic punctuation removed before fingerprinting.
const NON_SEMANTIC_PUNCTUATION = /[.,!?;:'"`()\[\]{}\-—–…·•*_=+/\\|@#$%^&]/g;

export function normalizeQuestion(context: string): string {
  return context
    .normalize("NFKC")
    .toLowerCase()
    .replace(NON_SEMANTIC_PUNCTUATION, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Stable composite of scene + goal + normalized context. Scene/goal are controlled enums.
export function normalizeComposite(
  scene: Scene,
  goal: InterpretationGoal,
  context: string,
): string {
  return `${scene}|${goal}|${normalizeQuestion(context)}`;
}

// Versioned HMAC so low-entropy questions cannot be brute-forced offline (§10.1).
// `key` is the raw secret for the given version; the caller supplies the active and
// previous versions during key rotation.
export function fingerprintQuestion(
  composite: string,
  key: string,
  keyVersion: string,
): string {
  const h = createHmac("sha256", key);
  h.update(`${keyVersion}:${composite}`);
  return `${keyVersion}.${h.digest("hex")}`;
}

export function fingerprintKeyVersion(fingerprint: string): string {
  const dot = fingerprint.indexOf(".");
  return dot === -1 ? "" : fingerprint.slice(0, dot);
}
