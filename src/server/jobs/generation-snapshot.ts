import { decryptJson, encryptJson, type EncryptedBlob } from "@/lib/crypto";
import type { GenerationInput } from "@/server/ai";

export type SealedGenerationSnapshot = {
  encrypted: EncryptedBlob;
  aad: string;
};

export function sealGenerationSnapshot(castingId: string, input: GenerationInput): SealedGenerationSnapshot {
  const aad = `generation:${castingId}`;
  return { encrypted: encryptJson(input, "context", undefined, aad), aad };
}

export function openGenerationSnapshot(snapshot: unknown): GenerationInput {
  if (typeof snapshot !== "object" || snapshot === null) throw new Error("GENERATION_SNAPSHOT_INVALID");
  const value = snapshot as Partial<SealedGenerationSnapshot>;
  if (!value.encrypted || typeof value.aad !== "string") throw new Error("GENERATION_SNAPSHOT_INVALID");
  return decryptJson<GenerationInput>(value.encrypted, "context", value.aad);
}
