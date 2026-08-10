import { ALGORITHM_VERSIONS, type LineValue } from "../types";
import { TRIGRAM_BITS, TRIGRAM_BY_NUMBER, TRIGRAM_NUMBER } from "../hexagrams/king-wen";

/**
 * Quick I Ching Gregorian Current-Time Convention v2.
 *
 * Classical current-time arithmetic uses a 1..12 year number, month, day and 1..12 hour branch.
 * Public V1 deliberately uses the user's Gregorian civil date instead of claiming lunar-calendar
 * equivalence: the Gregorian year is converted to its terrestrial-branch ordinal (2020 = Zi = 1),
 * month/day are Gregorian numbers, and 23:00 begins Zi hour and rolls the formula date to the next
 * Gregorian day. IANA timezone conversion is handled by Intl, including DST. Lunar months and leap
 * months are not used by this convention; Gregorian leap days are ordinary civil dates.
 */

export const MEI_HUA_CONVENTION_ID = "quickiching-gregorian-current-time-v2";

export type MeiHuaLocalFields = {
  year: number;
  month: number;
  day: number;
  hour: number;
  ianaTimeZone: string;
};

export type MeiHuaResult = {
  lineValuesBottomUp: [LineValue, LineValue, LineValue, LineValue, LineValue, LineValue];
  upperTrigram: string;
  lowerTrigram: string;
  movingLinePosition: number;
  methodCalculation: Record<string, unknown>;
  algorithmVersion: string;
};

export function hourBranch(localHour: number): number {
  if (!Number.isInteger(localHour) || localHour < 0 || localHour > 23) {
    throw new Error("MEI_HUA_INVALID_HOUR");
  }
  return (Math.floor((localHour + 1) / 2) % 12) + 1;
}

export function gregorianYearBranchNumber(year: number): number {
  if (!Number.isInteger(year)) throw new Error("MEI_HUA_INVALID_YEAR");
  return (((year - 2020) % 12) + 12) % 12 + 1;
}

export function localCalendarFields(utcMillis: number, ianaTimeZone: string): MeiHuaLocalFields {
  if (!Number.isFinite(utcMillis)) throw new Error("MEI_HUA_INVALID_INSTANT");
  const dtf = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
    timeZone: ianaTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(new Date(utcMillis));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  let year = Number(get("year"));
  let month = Number(get("month"));
  let day = Number(get("day"));
  const hour = Number(get("hour"));

  if (![year, month, day, hour].every(Number.isFinite)) throw new Error("MEI_HUA_DATE_FORMAT_FAILED");

  if (hour === 23) {
    const nextFormulaDay = new Date(Date.UTC(year, month - 1, day + 1));
    year = nextFormulaDay.getUTCFullYear();
    month = nextFormulaDay.getUTCMonth() + 1;
    day = nextFormulaDay.getUTCDate();
  }

  return { year, month, day, hour, ianaTimeZone };
}

function mod8(value: number): number {
  const remainder = ((value % 8) + 8) % 8;
  return remainder === 0 ? 8 : remainder;
}

function mod6(value: number): number {
  const remainder = ((value % 6) + 6) % 6;
  return remainder === 0 ? 6 : remainder;
}

export function meiHuaFromFields(fields: MeiHuaLocalFields): MeiHuaResult {
  const branch = hourBranch(fields.hour);
  const yearBranch = gregorianYearBranchNumber(fields.year);
  const dateSum = yearBranch + fields.month + fields.day;
  const upperNumber = mod8(dateSum);
  const fullSum = dateSum + branch;
  const lowerNumber = mod8(fullSum);
  const movingLinePosition = mod6(fullSum);

  const upperTrigram = TRIGRAM_BY_NUMBER[upperNumber];
  const lowerTrigram = TRIGRAM_BY_NUMBER[lowerNumber];
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

  return {
    lineValuesBottomUp: lineValues as MeiHuaResult["lineValuesBottomUp"],
    upperTrigram,
    lowerTrigram,
    movingLinePosition,
    methodCalculation: {
      conventionId: MEI_HUA_CONVENTION_ID,
      utcMillis: null,
      ianaTimeZone: fields.ianaTimeZone,
      calendar: "Gregorian civil date",
      lunarCalendarUsed: false,
      leapMonthHandling: "not applicable; lunar months are not used",
      leapDayHandling: "ordinary Gregorian civil date",
      yearBoundary: "Gregorian year with Zi-hour formula rollover at 23:00",
      year: fields.year,
      yearBranchNumber: yearBranch,
      month: fields.month,
      day: fields.day,
      hour: fields.hour,
      hourBranch: branch,
      ziHourRule: "23:00-00:59 = branch 1; 23:00 uses the next Gregorian formula date",
      upperTrigramNumber: TRIGRAM_NUMBER[upperTrigram],
      lowerTrigramNumber: TRIGRAM_NUMBER[lowerTrigram],
      movingLinePosition,
    },
    algorithmVersion: ALGORITHM_VERSIONS.mei_hua_current_time,
  };
}

export function meiHuaFromUtc(utcMillis: number, ianaTimeZone: string): MeiHuaResult {
  const fields = localCalendarFields(utcMillis, ianaTimeZone);
  const result = meiHuaFromFields(fields);
  result.methodCalculation.utcMillis = utcMillis;
  return result;
}
