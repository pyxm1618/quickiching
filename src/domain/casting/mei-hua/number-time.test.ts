import { describe, expect, it } from "vitest";
import {
  MEI_HUA_NUMBER_TIME_ALGORITHM_VERSION,
  MEI_HUA_NUMBER_TIME_CONVENTION_ID,
  earthlyBranchHourNumber,
  localHourAtInstant,
  meiHuaFromNumberAndTime,
  parseMeiHuaNumber,
  validateMeiHuaNumberTimeInput,
  validIanaTimeZone,
} from "./number-time";

describe("Mei Hua classical object-number + confirmed moment", () => {
  it("accepts positive safe integer counts and rejects zero, negative, non-integer and unsafe input", () => {
    expect(parseMeiHuaNumber("17")).toBe(17);
    expect(parseMeiHuaNumber(" +8 ")).toBe(8);
    for (const value of ["", "0", "-8", "1.5", "17x", "9007199254740991", "9007199254740992"]) {
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

  it("maps local civil hours to the traditional 1..12 double-hour ordinal", () => {
    expect(earthlyBranchHourNumber(23)).toBe(1);
    expect(earthlyBranchHourNumber(0)).toBe(1);
    expect(earthlyBranchHourNumber(1)).toBe(2);
    expect(earthlyBranchHourNumber(12)).toBe(7);
    expect(earthlyBranchHourNumber(13)).toBe(8);
    expect(earthlyBranchHourNumber(22)).toBe(12);
  });

  it("uses the user's IANA timezone to derive the local hour from the same UTC instant", () => {
    const instant = Date.UTC(2026, 9, 31, 0, 30);
    expect(localHourAtInstant(instant, "Asia/Shanghai")).toBe(8);
    expect(localHourAtInstant(instant, "Europe/London")).toBe(0);
    expect(meiHuaFromNumberAndTime({ number: 17, utcMillis: instant, ianaTimeZone: "Asia/Shanghai" }).lowerTrigram)
      .not.toBe(meiHuaFromNumberAndTime({ number: 17, utcMillis: instant, ianaTimeZone: "Europe/London" }).lowerTrigram);
  });

  it("has a reproducible classical fixture: number 17 + Xu hour => Qian over Li, line 4, 13 -> 37", () => {
    const input = {
      number: 17,
      utcMillis: Date.UTC(2026, 9, 31, 12, 0),
      ianaTimeZone: "Asia/Shanghai",
    };
    const result = meiHuaFromNumberAndTime(input);
    expect(result.algorithmVersion).toBe(MEI_HUA_NUMBER_TIME_ALGORITHM_VERSION);
    expect(result.upperTrigram).toBe("qian");
    expect(result.lowerTrigram).toBe("li");
    expect(result.movingLinePosition).toBe(4);
    expect(result.lineValuesBottomUp).toEqual([7, 8, 7, 9, 7, 7]);
    expect(result.primaryHexagramNumber).toBe(13);
    expect(result.relatingHexagramNumber).toBe(37);
    expect(result.methodCalculation).toMatchObject({
      conventionId: MEI_HUA_NUMBER_TIME_CONVENTION_ID,
      sourceRule: "梅花易数卷一·物数占例",
      number: 17,
      utcMillis: input.utcMillis,
      ianaTimeZone: "Asia/Shanghai",
      localHour: 20,
      timeNumber: 11,
      yearMonthDayUsed: false,
      upperTrigramNumber: 1,
      lowerTrigramNumber: 3,
      movingLinePosition: 4,
      primaryHexagramNumber: 13,
      relatingHexagramNumber: 37,
    });
  });

  it("maps zero trigram remainders to 8 and zero moving-line remainders to line 6", () => {
    const trigramBoundary = meiHuaFromNumberAndTime({
      number: 8,
      utcMillis: Date.UTC(2026, 9, 31, 5, 0),
      ianaTimeZone: "Asia/Shanghai",
    });
    expect(trigramBoundary.upperTrigram).toBe("kun");
    expect(trigramBoundary.lowerTrigram).toBe("kun");

    const lineBoundary = meiHuaFromNumberAndTime({
      number: 1,
      utcMillis: Date.UTC(2026, 9, 31, 0, 0),
      ianaTimeZone: "Asia/Shanghai",
    });
    expect(lineBoundary.movingLinePosition).toBe(6);
  });

  it("is deterministic for the same sealed number, instant and timezone", () => {
    const input = { number: 29, utcMillis: Date.UTC(2026, 10, 1, 1, 23, 45), ianaTimeZone: "Asia/Singapore" };
    expect(meiHuaFromNumberAndTime(input)).toEqual(meiHuaFromNumberAndTime(input));
  });
});
