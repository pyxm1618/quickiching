import { randomBytes, randomInt } from "node:crypto";

export function serverRandomBit(): boolean {
  return (randomBytes(1)[0] & 1) === 1;
}

export function serverRandomInt(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error("RANDOM_INVALID_RANGE");
  }
  return randomInt(0, maxExclusive);
}
