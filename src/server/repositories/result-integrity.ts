import { serializeCastResultIntegrity } from "@/domain/casting/result-integrity";
import { hmac, hmacMatches } from "@/lib/crypto";
import { runtimeConfig } from "@/server/config";
import { DomainError } from "@/server/errors/domain-error";
import type { CastResult, CastingSession } from "./models";

function serialized(session: CastingSession, result: CastResult): string {
  return serializeCastResultIntegrity({
    castingSessionId: result.castingSessionId,
    method: session.method,
    lineValues: result.lineValues,
    primaryHexagramNumber: result.primaryHexagramNumber,
    movingLinePositions: result.movingLinePositions,
    relatingHexagramNumber: result.relatingHexagramNumber,
    methodCalculation: result.methodCalculation,
    algorithmVersion: result.algorithmVersion,
    classicMappingVersion: result.classicMappingVersion,
  });
}

export function signCastResultIntegrity(
  session: CastingSession,
  result: CastResult,
): { resultHmac: string; resultHmacKeyVersion: string } {
  const keyVersion = runtimeConfig().keys.resultIntegrity.writeVersion;
  return {
    resultHmac: hmac(serialized(session, result), "result", keyVersion),
    resultHmacKeyVersion: keyVersion,
  };
}

export function castResultIntegrityMatches(session: CastingSession, result: CastResult): boolean {
  if (!result.resultHmacKeyVersion) return false;
  try {
    return hmacMatches(
      serialized(session, result),
      result.resultHmac,
      "result",
      result.resultHmacKeyVersion,
    );
  } catch {
    return false;
  }
}

export function assertCastResultIntegrity(session: CastingSession, result: CastResult): void {
  if (!castResultIntegrityMatches(session, result)) {
    throw new DomainError(
      "CAST_RESULT_INTEGRITY_FAILED",
      "The casting result failed integrity verification.",
      false,
    );
  }
}
