import { createHash } from "node:crypto";
import { hmacWithKeyMaterial, verifyHmacWithKeyMaterial } from "@/lib/crypto";
import type { DeterministicFacts } from "@/domain/generation/schemas";
import type { PreviewGenerationContext } from "./types";

type VersionedKey = { version: string; material: string };

function parseKeys(raw: string | undefined): VersionedKey[] {
  if (!raw?.trim()) return [];
  return raw.split(",").map((entry) => {
    const match = /^([A-Za-z0-9][A-Za-z0-9._-]*):(.+)$/.exec(entry.trim());
    if (!match || !match[2].trim()) throw new Error("RESULT_INTEGRITY_KEYS_INVALID");
    return { version: match[1], material: match[2].trim() };
  });
}

export function canonicalDeterministicFacts(facts: DeterministicFacts): string {
  return JSON.stringify({
    l: facts.lineValuesBottomUp,
    p: facts.primaryHexagramNumber,
    m: facts.movingLinePositions,
    r: facts.relatingHexagramNumber,
    method: facts.method,
    a: facts.algorithmVersion,
    c: facts.classicMappingVersion,
  });
}

export function resultIntegrityHmac(facts: DeterministicFacts, key: VersionedKey): string {
  return hmacWithKeyMaterial(canonicalDeterministicFacts(facts), "result-integrity", key.version, key.material);
}

export function createResultIntegrityVerifier(env: Record<string, string | undefined> = process.env) {
  const keys = parseKeys(env.RESULT_INTEGRITY_KEYS);
  return (context: PreviewGenerationContext): boolean => {
    const key = keys.find((candidate) => candidate.version === context.resultHmacKeyVersion);
    if (!key) return false;
    return verifyHmacWithKeyMaterial(
      canonicalDeterministicFacts(context.facts),
      context.resultHmac,
      "result-integrity",
      key.version,
      key.material,
    );
  };
}

export function calculateDeepReadingInputSnapshotHash(input: {
  castingId: string;
  userId: string;
  epoch: number;
  question: string;
  scene: string;
  interpretationGoal: string;
  facts: DeterministicFacts;
}): string {
  const canonicalFacts = canonicalDeterministicFacts(input.facts);
  return createHash("sha256")
    .update(`${input.castingId}:${input.userId}:${input.epoch}:${input.scene}:${input.interpretationGoal}:${input.question}:${canonicalFacts}`)
    .digest("hex");
}

export function calculateResultIntegrityHmac(
  facts: DeterministicFacts,
  env: Record<string, string | undefined> = process.env,
): { hmac: string; version: string } {
  const keys = parseKeys(env.RESULT_INTEGRITY_KEYS);
  if (keys.length === 0) {
    throw new Error("RESULT_INTEGRITY_KEYS_INVALID");
  }
  const key = keys[0];
  if (!key) throw new Error("RESULT_INTEGRITY_KEYS_INVALID");
  return {
    hmac: resultIntegrityHmac(facts, key),
    version: key.version,
  };
}
