import type { CastingStep } from "@/server/repositories/models";

export type CoinLineIndex = 0 | 1 | 2 | 3 | 4 | 5;
export type YarrowChangeIndex = 0 | 1 | 2;

export function findCoinStep(steps: CastingStep[], lineIndex: CoinLineIndex): CastingStep | undefined {
  return steps.find((step) => step.stepKind === "coin" && step.lineIndex === lineIndex);
}

export type CoinLineProgress = {
  lineIndex: CoinLineIndex;
  completed: boolean;
};

export function coinLineProgress(step: CastingStep, steps: CastingStep[]): CoinLineProgress {
  const coinSteps = steps.filter((candidate) => candidate.stepKind === "coin");
  return {
    lineIndex: step.lineIndex as CoinLineIndex,
    completed: coinSteps.length === 6,
  };
}

export function findYarrowStep(
  steps: CastingStep[],
  lineIndex: CoinLineIndex,
  changeIndex: YarrowChangeIndex,
): CastingStep | undefined {
  return steps.find((step) => step.stepKind === "yarrow_change"
    && step.lineIndex === lineIndex
    && step.changeIndex === changeIndex);
}

export type YarrowChangeProgress = {
  lineIndex: CoinLineIndex;
  changeIndex: YarrowChangeIndex;
  completed: boolean;
};

export function yarrowChangeProgress(step: CastingStep, steps: CastingStep[]): YarrowChangeProgress {
  void steps;
  return {
    lineIndex: step.lineIndex as CoinLineIndex,
    changeIndex: step.changeIndex as YarrowChangeIndex,
    completed: false,
  };
}
