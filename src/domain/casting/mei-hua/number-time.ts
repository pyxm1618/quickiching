import { buildHexagramResult } from "../hexagrams/compute";
import { TRIGRAM_BITS, TRIGRAM_BY_NUMBER, TRIGRAM_NUMBER } from "../hexagrams/king-wen";
import { ALGORITHM_VERSIONS, type LineValue } from "../types";
import type { MeiHuaResult } from "./algorithm";

export const MEI_HUA_NUMBER_TIME_INPUT_VERSION = "mei-hua-number-time-input-v1";
export const MEI_HUA_NUMBER_TIME_CONVENTION_ID = "mei-hua-classical-object-number-hour-v1";
export const MEI_HUA_NUMBER_TIME_ALGORITHM_VERSION = ALGORITHM_VERSIONS.mei_hua_number_time;

export type MeiHuaNumberTimeInput = {
  number: number;
  utcMillis: number;
  ianaTimeZone: string;
};

export type MeiHuaNumberTimeResult = MeiHuaResult & {
  primaryHexagramNumber: number;
  relatingHexagramNumber: number;
};

/**
 * Classical rule used by the active "one number + confirmed moment" flow.
 *
 * Primary source: 《梅花易数》卷一，物数占例
 * https://zh.wikisource.org/wiki/%E6%A2%85%E8%8A%B1%E6%98%93%E6%95%B8/%E5%8D%B7%E4%B8%80
 *
 * This source separates the rule from 年月日时起例: the user/count number makes
 * the upper trigram, the current 时数 makes the lower trigram, and number + 时数
 * selects the moving line. The same卷一 defines 乾1、兑2、离3、震4、巽5、坎6、
 * 艮7、坤8, 卦以八除 and 爻以六除. A zero trigram remainder is therefore 8
 * (坤), and a zero line remainder is line 6.
 *
 * 时数 is the traditional twelve double-hour Earthly-Branch ordinal:
 * 子1 (23:00-00:59), 丑2 (01:00-02:59), ... 亥12 (21:00-22:59).
 * utcMillis is converted through the supplied IANA timezone first. Year/month/day
 * do not enter this 物数占 formula.
 */
export function validIanaTimeZone(value: string): boolean {
  if (!value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function validCastInstant(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 253402300799999;
}

function validClassicalNumber(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && Number.isSafeInteger(value + 12);
}

export function parseMeiHuaNumber(value: string): number {
  const trimmed = value.trim();
  if (!/^\+?\d+$/u.test(trimmed)) throw new Error("MEI_HUA_INVALID_NUMBER");
  const parsed = Number(trimmed);
  if (!validClassicalNumber(parsed)) throw new Error("MEI_HUA_INVALID_NUMBER");
  return parsed;
}

export function validateMeiHuaNumberTimeInput(input: MeiHuaNumberTimeInput): MeiHuaNumberTimeInput {
  if (!validClassicalNumber(input.number)) throw new Error("MEI_HUA_INVALID_NUMBER");
  if (!validCastInstant(input.utcMillis)) throw new Error("MEI_HUA_INVALID_INSTANT");
  if (!validIanaTimeZone(input.ianaTimeZone)) throw new Error("MEI_HUA_INVALID_TIMEZONE");
  return input;
}

export function localHourAtInstant(utcMillis: number, ianaTimeZone: string): number {
  if (!validCastInstant(utcMillis)) throw new Error("MEI_HUA_INVALID_INSTANT");
  if (!validIanaTimeZone(ianaTimeZone)) throw new Error("MEI_HUA_INVALID_TIMEZONE");
  const dtf = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
    timeZone: ianaTimeZone,
    hour: "2-digit",
    hourCycle: "h23",
  });
  const hour = Number(dtf.formatToParts(new Date(utcMillis)).find((part) => part.type === "hour")?.value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error("MEI_HUA_DATE_FORMAT_FAILED");
  return hour;
}

export function earthlyBranchHourNumber(localHour: number): number {
  if (!Number.isInteger(localHour) || localHour < 0 || localHour > 23) throw new Error("MEI_HUA_INVALID_HOUR");
  return (Math.floor((localHour + 1) / 2) % 12) + 1;
}

function classicalRemainder(value: number, divisor: 6 | 8): number {
  const remainder = value % divisor;
  return remainder === 0 ? divisor : remainder;
}

export function meiHuaFromNumberAndTime(rawInput: MeiHuaNumberTimeInput): MeiHuaNumberTimeResult {
  const input = validateMeiHuaNumberTimeInput(rawInput);
  const localHour = localHourAtInstant(input.utcMillis, input.ianaTimeZone);
  const timeNumber = earthlyBranchHourNumber(localHour);
  const upperTrigramNumber = classicalRemainder(input.number, 8);
  const lowerTrigramNumber = classicalRemainder(timeNumber, 8);
  const numberPlusTime = input.number + timeNumber;
  const movingLinePosition = classicalRemainder(numberPlusTime, 6);

  const upperTrigram = TRIGRAM_BY_NUMBER[upperTrigramNumber];
  const lowerTrigram = TRIGRAM_BY_NUMBER[lowerTrigramNumber];
  if (!upperTrigram || !lowerTrigram) throw new Error("MEI_HUA_TRIGRAM_LOOKUP_FAILED");

  const upperBits = TRIGRAM_BITS[upperTrigram];
  const lowerBits = TRIGRAM_BITS[lowerTrigram];
  const lineValues: LineValue[] = [8, 8, 8, 8, 8, 8];
  for (let index = 0; index < 3; index += 1) {
    lineValues[index] = ((lowerBits >> index) & 1) === 1 ? 7 : 8;
    lineValues[index + 3] = ((upperBits >> index) & 1) === 1 ? 7 : 8;
  }

  const movingIndex = movingLinePosition - 1;
  lineValues[movingIndex] = lineValues[movingIndex] === 7 ? 9 : 6;
  const tuple = lineValues as MeiHuaResult["lineValuesBottomUp"];
  const hexagrams = buildHexagramResult({
    lineValuesBottomUp: tuple,
    method: "mei_hua_number_time",
    algorithmVersion: MEI_HUA_NUMBER_TIME_ALGORITHM_VERSION,
  });
  if (hexagrams.relatingHexagramNumber === null) throw new Error("MEI_HUA_RELATING_HEXAGRAM_MISSING");

  return {
    lineValuesBottomUp: tuple,
    upperTrigram,
    lowerTrigram,
    movingLinePosition,
    primaryHexagramNumber: hexagrams.primaryHexagramNumber,
    relatingHexagramNumber: hexagrams.relatingHexagramNumber,
    methodCalculation: {
      conventionId: MEI_HUA_NUMBER_TIME_CONVENTION_ID,
      sourceRule: "梅花易数卷一·物数占例",
      inputVersion: MEI_HUA_NUMBER_TIME_INPUT_VERSION,
      number: input.number,
      utcMillis: input.utcMillis,
      ianaTimeZone: input.ianaTimeZone,
      localHour,
      timeSystem: "Earthly-Branch double-hour ordinal; Zi=1 ... Hai=12",
      timeNumber,
      yearMonthDayUsed: false,
      upperRule: "user number mod 8; zero remainder = 8",
      lowerRule: "local Earthly-Branch hour number mod 8; zero remainder = 8",
      movingRule: "(user number + local Earthly-Branch hour number) mod 6; zero remainder = 6",
      numberPlusTime,
      upperTrigramNumber: TRIGRAM_NUMBER[upperTrigram],
      lowerTrigramNumber: TRIGRAM_NUMBER[lowerTrigram],
      movingLinePosition,
      primaryHexagramNumber: hexagrams.primaryHexagramNumber,
      relatingHexagramNumber: hexagrams.relatingHexagramNumber,
    },
    algorithmVersion: MEI_HUA_NUMBER_TIME_ALGORITHM_VERSION,
  };
}
