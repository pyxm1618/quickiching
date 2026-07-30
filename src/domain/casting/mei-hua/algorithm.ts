import { ALGORITHM_VERSIONS, type LineValue } from "../types";
import { TRIGRAM_BITS, TRIGRAM_BY_NUMBER, TRIGRAM_NUMBER } from "../hexagrams/king-wen";

// §8.4 Mei Hua Yi Shu — Current-Time Casting v1.
// Uses the current server time + user-confirmed IANA timezone. No history backfill allowed.
// Standard Shao Yong rule:
//   upper trigram = (year + month + day) mod 8  (0 => 8)
//   lower trigram = (year + month + day + hourBranch) mod 8
//   moving line   = (year + month + day + hourBranch) mod 6  (0 => 6)
// Trigram numbering: qian=1 dui=2 li=3 zhen=4 xun=5 kan=6 gen=7 kun=8.
//
// NOTE: True 闰月 / 子时换日 / 农历 / DST edge handling requires an approved calendar
// library (PRD §21 G-04, D0 Blocked). MVP uses the Gregorian + standard 12-branch rule with
// the traditional 子时 day rollover, computed via Intl (DST-aware). Clearly a simplification.

export type MeiHuaLocalFields = {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  hour: number; // 0..23 local
  ianaTimeZone: string;
};

export type MeiHuaResult = {
  lineValuesBottomUp: [LineValue, LineValue, LineValue, LineValue, LineValue, LineValue];
  upperTrigram: string;
  lowerTrigram: string;
  movingLinePosition: number; // 1..6
  methodCalculation: Record<string, unknown>;
  algorithmVersion: string;
};

// 12 terrestrial branches; 子时 spans 23:00–00:59 and rolls the day forward.
export function hourBranch(localHour: number): number {
  // 23 => 子(1); 0 => 子(1); 1 => 丑(2); 11 => 午(7); 12 => 午(7) ...
  const b = (Math.floor((localHour + 1) / 2) % 12) + 1;
  return b;
}

// Local calendar fields from a fixed UTC instant in the given IANA timezone.
export function localCalendarFields(utcMillis: number, ianaTimeZone: string): MeiHuaLocalFields {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: ianaTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date(utcMillis));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  let year = parseInt(get("year"), 10);
  let month = parseInt(get("month"), 10);
  let day = parseInt(get("day"), 10);
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some runtimes emit 24 for midnight

  // Traditional 子时 day rollover: hour 23 belongs to the next day's 子时.
  if (hour === 23) {
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = next.getUTCDate();
  }

  return { year, month, day, hour, ianaTimeZone };
}

function mod8(n: number): number {
  const r = ((n % 8) + 8) % 8;
  return r === 0 ? 8 : r;
}
function mod6(n: number): number {
  const r = ((n % 6) + 6) % 6;
  return r === 0 ? 6 : r;
}

export function meiHuaFromFields(fields: MeiHuaLocalFields): MeiHuaResult {
  const branch = hourBranch(fields.hour);
  const upperNum = mod8(fields.year + fields.month + fields.day);
  const lowerNum = mod8(fields.year + fields.month + fields.day + branch);
  const movingLinePosition = mod6(fields.year + fields.month + fields.day + branch);

  const upperTrigram = TRIGRAM_BY_NUMBER[upperNum];
  const lowerTrigram = TRIGRAM_BY_NUMBER[lowerNum];

  const upperBits = TRIGRAM_BITS[upperTrigram]; // bits for lines 4-6 (top)
  const lowerBits = TRIGRAM_BITS[lowerTrigram]; // bits for lines 1-3 (bottom)

  const lineValues: LineValue[] = [8, 8, 8, 8, 8, 8];
  for (let i = 0; i < 3; i++) {
    const bit = (lowerBits >> i) & 1;
    lineValues[i] = bit === 1 ? 7 : 8;
  }
  for (let i = 0; i < 3; i++) {
    const bit = (upperBits >> i) & 1;
    lineValues[i + 3] = bit === 1 ? 7 : 8;
  }

  // Apply the single moving line: flip the bit at position (1-based).
  const pos = movingLinePosition - 1;
  const primaryBit = (lineValues[pos] === 7 || lineValues[pos] === 9) ? 1 : 0;
  lineValues[pos] = primaryBit === 1 ? 9 : 6;

  return {
    lineValuesBottomUp: lineValues as MeiHuaResult["lineValuesBottomUp"],
    upperTrigram,
    lowerTrigram,
    movingLinePosition,
    methodCalculation: {
      rule: "shao-yong-current-time-v1",
      utcMillis: null, // filled by caller (kept stable)
      ianaTimeZone: fields.ianaTimeZone,
      year: fields.year,
      month: fields.month,
      day: fields.day,
      hour: fields.hour,
      hourBranch: branch,
      upperTrigramNumber: TRIGRAM_NUMBER[upperTrigram],
      lowerTrigramNumber: TRIGRAM_NUMBER[lowerTrigram],
      movingLinePosition,
    },
    algorithmVersion: ALGORITHM_VERSIONS.mei_hua_current_time,
  };
}

// Convenience for production: derive fields from a fixed UTC instant.
export function meiHuaFromUtc(utcMillis: number, ianaTimeZone: string): MeiHuaResult {
  const fields = localCalendarFields(utcMillis, ianaTimeZone);
  const result = meiHuaFromFields(fields);
  result.methodCalculation.utcMillis = utcMillis;
  return result;
}
