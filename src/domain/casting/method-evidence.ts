import type { HexagramResult, LineValue } from "./types";

export type MethodEvidenceResult = Omit<HexagramResult, "lineValuesBottomUp"> & {
  lineValuesBottomUp: readonly LineValue[];
};

export type ThreeCoinRoundEvidence = {
  linePosition: 1 | 2 | 3 | 4 | 5 | 6;
  coinValues: readonly [2 | 3, 2 | 3, 2 | 3];
  lineValue: LineValue;
};

export type ThreeCoinMethodEvidence = {
  method: "three_coin";
  rounds: readonly ThreeCoinRoundEvidence[];
};

export type YarrowChangeEvidence = {
  linePosition: 1 | 2 | 3 | 4 | 5 | 6;
  changeIndex: 1 | 2 | 3;
  stalksBefore: number;
  leftPile: number;
  rightPile: number;
  removedRemainders: number;
  stalksAfter: number;
};

export type YarrowMethodEvidence = {
  method: "yarrow_stalk";
  changes: readonly YarrowChangeEvidence[];
  lineValues: readonly LineValue[];
};

export type MeiHuaMethodEvidence = {
  method: "mei_hua_current_time";
  inputTimestamp: string;
  ianaTimeZone: string;
  calendarSystem: "chinese_lunisolar";
  lunisolarDate: {
    cycleYear: number;
    lunarMonth: number;
    lunarDay: number;
    doubleHourBranch: number;
  };
  upperTrigramNumber: number;
  lowerTrigramNumber: number;
  movingLinePosition: number;
  bodyTrigram: "upper" | "lower";
  useTrigram: "upper" | "lower";
  calculationVersion: string;
};

export type CastingMethodEvidence =
  | ThreeCoinMethodEvidence
  | YarrowMethodEvidence
  | MeiHuaMethodEvidence;

function invalid(): never {
  throw new Error("CASTING_METHOD_EVIDENCE_INVALID");
}

function sameLineValues(actual: readonly number[], expected: readonly number[]): boolean {
  return actual.length === 6 && expected.length === 6
    && actual.every((value, index) => value === expected[index]);
}

function assertThreeCoin(
  evidence: ThreeCoinMethodEvidence,
  result: MethodEvidenceResult,
): void {
  if (evidence.rounds.length !== 6) invalid();
  const positions = new Set<number>();
  const derived: number[] = [];
  for (const round of evidence.rounds) {
    if (!Number.isInteger(round.linePosition) || round.linePosition < 1 || round.linePosition > 6) invalid();
    if (positions.has(round.linePosition)) invalid();
    positions.add(round.linePosition);
    if (round.coinValues.length !== 3 || round.coinValues.some((coin) => coin !== 2 && coin !== 3)) invalid();
    const sum = round.coinValues.reduce<number>((total, coin) => total + coin, 0);
    if (sum !== round.lineValue || ![6, 7, 8, 9].includes(round.lineValue)) invalid();
    derived[round.linePosition - 1] = round.lineValue;
  }
  if (!sameLineValues(derived, result.lineValuesBottomUp)) invalid();
}

function assertYarrow(
  evidence: YarrowMethodEvidence,
  result: MethodEvidenceResult,
): void {
  if (evidence.changes.length !== 18 || evidence.lineValues.length !== 6) invalid();
  for (let index = 0; index < evidence.changes.length; index += 1) {
    const change = evidence.changes[index];
    const expectedLine = Math.floor(index / 3) + 1;
    const expectedChange = (index % 3) + 1;
    if (change.linePosition !== expectedLine || change.changeIndex !== expectedChange) invalid();
    for (const value of [
      change.stalksBefore,
      change.leftPile,
      change.rightPile,
      change.removedRemainders,
      change.stalksAfter,
    ]) {
      if (!Number.isSafeInteger(value) || value < 0) invalid();
    }
    if (change.stalksAfter >= change.stalksBefore) invalid();
    if (change.removedRemainders !== change.stalksBefore - change.stalksAfter) invalid();
    if (change.leftPile + change.rightPile !== change.stalksBefore) invalid();
    if (![4, 5, 8, 9].includes(change.removedRemainders)) invalid();
    if (index % 3 !== 0 && change.stalksBefore !== evidence.changes[index - 1].stalksAfter) invalid();
  }
  if (!sameLineValues(evidence.lineValues, result.lineValuesBottomUp)) invalid();
}

function assertIanaTimeZone(value: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
  } catch {
    invalid();
  }
}

function assertMeiHua(
  evidence: MeiHuaMethodEvidence,
  result: MethodEvidenceResult,
): void {
  if (evidence.calendarSystem !== "chinese_lunisolar") invalid();
  const timestamp = new Date(evidence.inputTimestamp);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== evidence.inputTimestamp) invalid();
  assertIanaTimeZone(evidence.ianaTimeZone);
  const { cycleYear, lunarMonth, lunarDay, doubleHourBranch } = evidence.lunisolarDate;
  if (!Number.isSafeInteger(cycleYear) || cycleYear < 1 || cycleYear > 60) invalid();
  if (!Number.isSafeInteger(lunarMonth) || lunarMonth < 1 || lunarMonth > 12) invalid();
  if (!Number.isSafeInteger(lunarDay) || lunarDay < 1 || lunarDay > 30) invalid();
  if (!Number.isSafeInteger(doubleHourBranch) || doubleHourBranch < 1 || doubleHourBranch > 12) invalid();
  if (!Number.isSafeInteger(evidence.upperTrigramNumber) || evidence.upperTrigramNumber < 1 || evidence.upperTrigramNumber > 8) invalid();
  if (!Number.isSafeInteger(evidence.lowerTrigramNumber) || evidence.lowerTrigramNumber < 1 || evidence.lowerTrigramNumber > 8) invalid();
  if (!Number.isSafeInteger(evidence.movingLinePosition) || evidence.movingLinePosition < 1 || evidence.movingLinePosition > 6) invalid();
  if (evidence.bodyTrigram === evidence.useTrigram) invalid();
  if (evidence.movingLinePosition !== result.movingLinePositions[0] || result.movingLinePositions.length !== 1) invalid();
  if (evidence.calculationVersion !== result.algorithmVersion) invalid();
}

export function assertMethodEvidenceMatchesResult(
  evidence: CastingMethodEvidence,
  result: MethodEvidenceResult,
): void {
  if (result.lineValuesBottomUp.length !== 6 || evidence.method !== result.method) invalid();
  switch (evidence.method) {
    case "three_coin":
      assertThreeCoin(evidence, result);
      return;
    case "yarrow_stalk":
      assertYarrow(evidence, result);
      return;
    case "mei_hua_current_time":
      assertMeiHua(evidence, result);
      return;
    default: {
      const exhaustive: never = evidence;
      return exhaustive;
    }
  }
}

export function verifiedHexagramResult(
  evidence: CastingMethodEvidence,
  result: MethodEvidenceResult,
): HexagramResult {
  assertMethodEvidenceMatchesResult(evidence, result);
  const [line1, line2, line3, line4, line5, line6] = result.lineValuesBottomUp;
  return {
    ...result,
    lineValuesBottomUp: [line1, line2, line3, line4, line5, line6],
    movingLinePositions: [...result.movingLinePositions],
  };
}
