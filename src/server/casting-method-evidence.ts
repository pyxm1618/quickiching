import type {
  CastingMethodEvidence,
  MeiHuaMethodEvidence,
  ThreeCoinRoundEvidence,
  YarrowChangeEvidence,
} from "@/domain/casting/method-evidence";
import type { LineValue } from "@/domain/casting/types";
import { DomainError } from "@/server/errors/domain-error";
import type { CastResult, CastingSession, CastingStep } from "@/server/repositories/models";

function invalid(): never {
  throw new DomainError(
    "CASTING_METHOD_EVIDENCE_INVALID",
    "The persisted casting process cannot be verified.",
    false,
  );
}

function integer(value: unknown): number {
  if (!Number.isSafeInteger(value)) return invalid();
  return value as number;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}

function buildThreeCoinEvidence(steps: CastingStep[]): CastingMethodEvidence {
  const coinSteps = steps
    .filter((step) => step.stepKind === "coin")
    .sort((left, right) => left.lineIndex - right.lineIndex);
  if (coinSteps.length !== 6) return invalid();
  const rounds: ThreeCoinRoundEvidence[] = coinSteps.map((step) => {
    const raw = record(step.rawRecord);
    const faces = raw.coinFaces;
    if (!Array.isArray(faces) || faces.length !== 3) return invalid();
    const coinValues = faces.map((face) => {
      if (face === "yang") return 3 as const;
      if (face === "yin") return 2 as const;
      return invalid();
    });
    if (![6, 7, 8, 9].includes(Number(step.lineValue))) return invalid();
    return {
      linePosition: (step.lineIndex + 1) as ThreeCoinRoundEvidence["linePosition"],
      coinValues: coinValues as unknown as ThreeCoinRoundEvidence["coinValues"],
      lineValue: step.lineValue as LineValue,
    };
  });
  return { method: "three_coin", rounds };
}

function buildYarrowEvidence(result: CastResult, steps: CastingStep[]): CastingMethodEvidence {
  const yarrowSteps = steps
    .filter((step) => step.stepKind === "yarrow_change")
    .sort((left, right) => left.lineIndex - right.lineIndex
      || (left.changeIndex ?? -1) - (right.changeIndex ?? -1));
  if (yarrowSteps.length !== 18) return invalid();
  const changes: YarrowChangeEvidence[] = yarrowSteps.map((step) => {
    const raw = record(step.rawRecord);
    const linePosition = step.lineIndex + 1;
    const changeIndex = (step.changeIndex ?? -1) + 1;
    if (linePosition < 1 || linePosition > 6 || changeIndex < 1 || changeIndex > 3) return invalid();
    const stalksBefore = integer(raw.startingStalks);
    const leftPile = integer(raw.leftGroup);
    const rightPile = integer(raw.rightGroup);
    const stalksAfter = integer(raw.endingStalks);
    return {
      linePosition: linePosition as YarrowChangeEvidence["linePosition"],
      changeIndex: changeIndex as YarrowChangeEvidence["changeIndex"],
      stalksBefore,
      leftPile,
      rightPile,
      removedRemainders: stalksBefore - stalksAfter,
      stalksAfter,
    };
  });
  return {
    method: "yarrow_stalk",
    changes,
    lineValues: [...result.lineValues],
  };
}

function buildMeiHuaEvidence(result: CastResult): CastingMethodEvidence {
  const calculation = record(result.methodCalculation);
  if (calculation.calendarSystem !== "chinese_lunisolar") return invalid();
  const bodyTrigram = calculation.bodyTrigram;
  const useTrigram = calculation.useTrigram;
  if ((bodyTrigram !== "upper" && bodyTrigram !== "lower")
    || (useTrigram !== "upper" && useTrigram !== "lower")) return invalid();
  const timestamp = calculation.inputTimestamp;
  const ianaTimeZone = calculation.ianaTimeZone;
  const calculationVersion = calculation.calculationVersion;
  if (typeof timestamp !== "string" || typeof ianaTimeZone !== "string" || typeof calculationVersion !== "string") {
    return invalid();
  }
  const evidence: MeiHuaMethodEvidence = {
    method: "mei_hua_current_time",
    inputTimestamp: timestamp,
    ianaTimeZone,
    calendarSystem: "chinese_lunisolar",
    lunisolarDate: {
      cycleYear: integer(calculation.cycleYear),
      lunarMonth: integer(calculation.lunarMonth),
      lunarDay: integer(calculation.lunarDay),
      doubleHourBranch: integer(calculation.doubleHourBranch),
    },
    upperTrigramNumber: integer(calculation.upperTrigramNumber),
    lowerTrigramNumber: integer(calculation.lowerTrigramNumber),
    movingLinePosition: integer(calculation.movingLinePosition),
    bodyTrigram,
    useTrigram,
    calculationVersion,
  };
  return evidence;
}

export function buildCastingMethodEvidence(input: {
  session: CastingSession;
  result: CastResult;
  steps: CastingStep[];
}): CastingMethodEvidence {
  switch (input.session.method) {
    case "three_coin":
      return buildThreeCoinEvidence(input.steps);
    case "yarrow_stalk":
      return buildYarrowEvidence(input.result, input.steps);
    case "mei_hua_current_time":
      return buildMeiHuaEvidence(input.result);
    default: {
      const exhaustive: never = input.session.method;
      return exhaustive;
    }
  }
}
