import type { MeiHuaResult } from "./algorithm";

export const MEI_HUA_NUMBER_TIME_INPUT_VERSION = "mei-hua-number-time-input-v1";
export const MEI_HUA_NUMBER_TIME_ALGORITHM_STATUS = "unverified" as const;

export type MeiHuaNumberTimeInput = {
  number: number;
  utcMillis: number;
  ianaTimeZone: string;
};

export function validIanaTimeZone(value: string): boolean {
  if (!value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function parseMeiHuaNumber(value: string): number {
  const trimmed = value.trim();
  if (!/^[+-]?\d+$/u.test(trimmed)) throw new Error("MEI_HUA_INVALID_NUMBER");
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) throw new Error("MEI_HUA_INVALID_NUMBER");
  return parsed;
}

export function validateMeiHuaNumberTimeInput(input: MeiHuaNumberTimeInput): MeiHuaNumberTimeInput {
  if (!Number.isSafeInteger(input.number)) throw new Error("MEI_HUA_INVALID_NUMBER");
  if (!Number.isFinite(input.utcMillis)) throw new Error("MEI_HUA_INVALID_INSTANT");
  if (!validIanaTimeZone(input.ianaTimeZone)) throw new Error("MEI_HUA_INVALID_TIMEZONE");
  return input;
}

/**
 * Deliberate integration boundary for the new "one number + confirmed moment" flow.
 *
 * The repository currently contains a verified Gregorian current-time convention, but it does not
 * consume a user number. The product rule for combining one user number with cast time has not yet
 * been approved, so this function must not derive or fabricate a hexagram.
 *
 * Once the rule is approved, implement it here and return a MeiHuaResult. Callers already preserve
 * the exact number, UTC instant, and IANA timezone needed by that future implementation.
 */
export function tryMeiHuaFromNumberAndTime(input: MeiHuaNumberTimeInput): MeiHuaResult | null {
  validateMeiHuaNumberTimeInput(input);
  return null;
}
