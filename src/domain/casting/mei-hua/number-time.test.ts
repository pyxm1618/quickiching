import { describe, expect, it } from "vitest";
import {
  MEI_HUA_NUMBER_TIME_ALGORITHM_STATUS,
  parseMeiHuaNumber,
  tryMeiHuaFromNumberAndTime,
  validateMeiHuaNumberTimeInput,
  validIanaTimeZone,
} from "./number-time";

describe("Mei Hua number + time input boundary", () => {
  it("accepts safe integer number input without inventing a product range", () => {
    expect(parseMeiHuaNumber("17")).toBe(17);
    expect(parseMeiHuaNumber(" 0 ")).toBe(0);
    expect(parseMeiHuaNumber("-8")).toBe(-8);
  });

  it("rejects non-integer and unsafe numeric input", () => {
    for (const value of ["", "1.5", "17x", "9007199254740992"]) {
      expect(() => parseMeiHuaNumber(value)).toThrow("MEI_HUA_INVALID_NUMBER");
    }
  });

  it("validates the exact cast instant and IANA timezone", () => {
    expect(validIanaTimeZone("Europe/London")).toBe(true);
    expect(validIanaTimeZone("not/a-zone")).toBe(false);
    expect(validateMeiHuaNumberTimeInput({
      number: 17,
      utcMillis: Date.UTC(2026, 9, 30, 11, 42),
      ianaTimeZone: "Europe/London",
    })).toEqual({
      number: 17,
      utcMillis: Date.UTC(2026, 9, 30, 11, 42),
      ianaTimeZone: "Europe/London",
    });
    expect(() => validateMeiHuaNumberTimeInput({
      number: 17,
      utcMillis: Number.NaN,
      ianaTimeZone: "Europe/London",
    })).toThrow("MEI_HUA_INVALID_INSTANT");
    expect(() => validateMeiHuaNumberTimeInput({
      number: 17,
      utcMillis: Date.now(),
      ianaTimeZone: "not/a-zone",
    })).toThrow("MEI_HUA_INVALID_TIMEZONE");
  });

  it("does not fabricate a hexagram while the number + time rule is unverified", () => {
    expect(MEI_HUA_NUMBER_TIME_ALGORITHM_STATUS).toBe("unverified");
    expect(tryMeiHuaFromNumberAndTime({
      number: 17,
      utcMillis: Date.UTC(2026, 9, 30, 11, 42),
      ianaTimeZone: "Europe/London",
    })).toBeNull();
  });
});
