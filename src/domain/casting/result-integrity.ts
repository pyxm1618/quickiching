import type { CastingMethod } from "./types";

export type CastResultIntegrityInput = {
  castingSessionId: string;
  method: CastingMethod;
  lineValues: readonly number[];
  primaryHexagramNumber: number;
  movingLinePositions: readonly number[];
  relatingHexagramNumber: number | null;
  methodCalculation: unknown;
  algorithmVersion: string;
  classicMappingVersion: string;
};

type CanonicalJson = null | boolean | number | string | CanonicalJson[] | { [key: string]: CanonicalJson };

function invalid(): never {
  throw new Error("CAST_RESULT_CANONICALIZATION_INVALID");
}

function canonicalize(value: unknown): CanonicalJson {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return invalid();
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return invalid();
    const output: { [key: string]: CanonicalJson } = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child === undefined) return invalid();
      output[key] = canonicalize(child);
    }
    return output;
  }
  return invalid();
}

function assertIntegerInRange(value: number, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) return invalid();
  return value;
}

export function serializeCastResultIntegrity(input: CastResultIntegrityInput): string {
  if (!input.castingSessionId || !input.algorithmVersion || !input.classicMappingVersion) return invalid();
  if (!["three_coin", "yarrow_stalk", "mei_hua_current_time"].includes(input.method)) return invalid();
  if (input.lineValues.length !== 6) return invalid();
  const lineValues = input.lineValues.map((value) => assertIntegerInRange(value, 6, 9));
  const movingLinePositions = input.movingLinePositions.map(
    (value) => assertIntegerInRange(value, 1, 6),
  );
  if (new Set(movingLinePositions).size !== movingLinePositions.length) return invalid();
  const primaryHexagramNumber = assertIntegerInRange(input.primaryHexagramNumber, 1, 64);
  const relatingHexagramNumber = input.relatingHexagramNumber === null
    ? null
    : assertIntegerInRange(input.relatingHexagramNumber, 1, 64);

  return JSON.stringify(canonicalize({
    schema: "cast-result-integrity-v1",
    castingSessionId: input.castingSessionId,
    method: input.method,
    lineValues,
    primaryHexagramNumber,
    movingLinePositions,
    relatingHexagramNumber,
    methodCalculation: input.methodCalculation,
    algorithmVersion: input.algorithmVersion,
    classicMappingVersion: input.classicMappingVersion,
  }));
}
