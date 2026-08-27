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

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function canonicalDeterministicFacts(facts: DeterministicFacts): string {
  return canonicalJson({
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
  return createHash("sha256")
    .update(canonicalJson({
      castingId: input.castingId,
      userId: input.userId,
      epoch: input.epoch,
      question: input.question,
      scene: input.scene,
      interpretationGoal: input.interpretationGoal,
      facts: input.facts,
    }))
    .digest("hex");
}

export type DeepReadingResultIntegrityInput = {
  castingId: string;
  jobId: string;
  reservationId: string;
  output: unknown;
  facts: DeterministicFacts;
  schemaVersion: string;
  promptVersion: string;
  provider: string;
  model: string;
};

export function calculateDeepReadingResultIntegrity(
  input: DeepReadingResultIntegrityInput,
  env: Record<string, string | undefined> = process.env,
): { hmac: string; version: string } {
  const keys = parseKeys(env.RESULT_INTEGRITY_KEYS);
  const key = keys[0];
  if (!key) throw new Error("RESULT_INTEGRITY_KEYS_INVALID");
  const payload = canonicalJson({
    castingId: input.castingId,
    jobId: input.jobId,
    reservationId: input.reservationId,
    output: input.output,
    facts: input.facts,
    schemaVersion: input.schemaVersion,
    promptVersion: input.promptVersion,
    provider: input.provider,
    model: input.model,
  });
  return {
    hmac: hmacWithKeyMaterial(payload, "deep-reading-result-integrity", key.version, key.material),
    version: key.version,
  };
}

export function calculateResultIntegrityHmac(
  facts: DeterministicFacts,
  env: Record<string, string | undefined> = process.env,
): { hmac: string; version: string } {
  const keys = parseKeys(env.RESULT_INTEGRITY_KEYS);
  const key = keys[0];
  if (!key) throw new Error("RESULT_INTEGRITY_KEYS_INVALID");
  return {
    hmac: resultIntegrityHmac(facts, key),
    version: key.version,
  };
}
