import type { CastingRepository } from "../casting-repository";
import {
  assertCastResultIntegrity,
  signCastResultIntegrity,
} from "../result-integrity";
import type { MemoryStore } from "./store";

export function withMemoryCastResultIntegrity(
  repository: CastingRepository,
  store: MemoryStore,
): CastingRepository {
  function signStored(castingSessionId: string): void {
    const session = store.castingSessions.get(castingSessionId);
    const result = store.castResults.get(castingSessionId);
    if (!session || !result) return;
    const signature = signCastResultIntegrity(session, result);
    result.resultHmac = signature.resultHmac;
    result.resultHmacKeyVersion = signature.resultHmacKeyVersion;
  }

  return new Proxy(repository, {
    get(target, property, receiver) {
      if (property === "saveCastResult") {
        return (input: Parameters<CastingRepository["saveCastResult"]>[0]) => {
          target.saveCastResult(input);
          signStored(input.castingSessionId);
          return target.getCastResult(input.castingSessionId)!;
        };
      }
      if (property === "recordCoinStep") {
        return async (input: Parameters<CastingRepository["recordCoinStep"]>[0]) => {
          const outcome = await target.recordCoinStep(input);
          if (outcome.completed) signStored(input.castingSessionId);
          return outcome;
        };
      }
      if (property === "getCastResult") {
        return (castingSessionId: string) => {
          const session = store.castingSessions.get(castingSessionId);
          const stored = store.castResults.get(castingSessionId);
          if (!stored) return undefined;
          if (!session) return undefined;
          assertCastResultIntegrity(session, stored);
          return target.getCastResult(castingSessionId);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
