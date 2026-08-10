import { ALGORITHM_VERSIONS, type LineValue } from "../types";

/**
 * Quick I Ching's Public V1 yarrow convention follows the Zhu Xi-style 49-stalk arithmetic:
 * three changes form one line and eighteen changes form a hexagram. For a digital tool we make
 * the conventional change probabilities explicit instead of pretending that an arbitrary UI
 * split gesture has a historically fixed probability distribution.
 *
 * First change: remove 5 with probability 3/4, or 9 with probability 1/4.
 * Later changes: remove 4 or 8 with equal probability.
 * This yields line probabilities 6/7/8/9 = 1/16, 5/16, 7/16, 3/16.
 * The selected outcome is then represented by a real valid left/right split, so every recorded
 * change still satisfies the 49-stalk conservation arithmetic.
 *
 * One unbiased integer sample is consumed per change. The sample space is divisible by every
 * valid split count that can occur in this 49-stalk procedure as well as by 4 and 2, allowing the
 * outcome and the conditional split index to be derived from the same draw without modulo bias.
 */

export type YarrowChange = {
  lineIndex: 0 | 1 | 2 | 3 | 4 | 5;
  changeIndex: 0 | 1 | 2;
  startingStalks: number;
  leftGroup: number;
  rightGroup: number;
  removedFromRight: 1;
  leftRemainder: 1 | 2 | 3 | 4;
  rightRemainder: 1 | 2 | 3 | 4;
  endingStalks: number;
  algorithmVersion: string;
};

export type YarrowLineResult = {
  lineIndex: 0 | 1 | 2 | 3 | 4 | 5;
  lineValue: LineValue;
  changes: YarrowChange[];
  algorithmVersion: string;
};

export type RandomInt = (maxExclusive: number) => number;

// LCM of 4 * every possible valid-split count reachable in the three-change procedure.
// 931,170,240 < 2^32, so browser Uint32 rejection sampling can draw it exactly.
const YARROW_SAMPLE_SPACE = 931_170_240;

function remainderOf(count: number): 1 | 2 | 3 | 4 {
  const remainder = count % 4;
  return (remainder === 0 ? 4 : remainder) as 1 | 2 | 3 | 4;
}

function removedCountForSplit(startingStalks: number, leftGroup: number): number {
  const rightGroup = startingStalks - leftGroup;
  return 1 + remainderOf(leftGroup) + remainderOf(rightGroup - 1);
}

function targetRemoved(changeIndex: 0 | 1 | 2, sample: number): 4 | 5 | 8 | 9 {
  if (changeIndex === 0) return sample % 4 === 0 ? 9 : 5;
  return sample % 2 === 0 ? 8 : 4;
}

function validSplits(startingStalks: number, target: number): number[] {
  const candidates: number[] = [];
  for (let leftGroup = 1; leftGroup < startingStalks; leftGroup += 1) {
    if (removedCountForSplit(startingStalks, leftGroup) === target) candidates.push(leftGroup);
  }
  return candidates;
}

function conditionalSplitIndex(changeIndex: 0 | 1 | 2, sample: number, candidateCount: number): number {
  const quotient = changeIndex === 0 ? Math.floor(sample / 4) : Math.floor(sample / 2);
  return quotient % candidateCount;
}

export function generateYarrowChange(
  lineIndex: 0 | 1 | 2 | 3 | 4 | 5,
  changeIndex: 0 | 1 | 2,
  startingStalks: number,
  randomInt: RandomInt,
): YarrowChange {
  if (!Number.isInteger(startingStalks) || startingStalks < 24 || startingStalks > 49) {
    throw new Error("YARROW_INVALID_STARTING_STALKS");
  }

  const sample = randomInt(YARROW_SAMPLE_SPACE);
  if (!Number.isInteger(sample) || sample < 0 || sample >= YARROW_SAMPLE_SPACE) {
    throw new Error("YARROW_RANDOM_OUT_OF_RANGE");
  }

  const target = targetRemoved(changeIndex, sample);
  const candidates = validSplits(startingStalks, target);
  if (candidates.length === 0) throw new Error("YARROW_NO_VALID_SPLIT");

  const leftGroup = candidates[conditionalSplitIndex(changeIndex, sample, candidates.length)];
  if (leftGroup === undefined) throw new Error("YARROW_RANDOM_OUT_OF_RANGE");
  const rightGroup = startingStalks - leftGroup;
  const leftRemainder = remainderOf(leftGroup);
  const rightRemainder = remainderOf(rightGroup - 1);
  const removedFromRight = 1 as const;
  const endingStalks = startingStalks - leftRemainder - rightRemainder - removedFromRight;

  return {
    lineIndex,
    changeIndex,
    startingStalks,
    leftGroup,
    rightGroup,
    removedFromRight,
    leftRemainder,
    rightRemainder,
    endingStalks,
    algorithmVersion: ALGORITHM_VERSIONS.yarrow_stalk,
  };
}

export function generateYarrowLine(
  lineIndex: 0 | 1 | 2 | 3 | 4 | 5,
  randomInt: RandomInt,
): YarrowLineResult {
  let stalks = 49;
  const changes: YarrowChange[] = [];

  for (let index = 0; index < 3; index += 1) {
    const changeIndex = index as 0 | 1 | 2;
    const change = generateYarrowChange(lineIndex, changeIndex, stalks, randomInt);
    changes.push(change);
    stalks = change.endingStalks;
  }

  const lineValue = (stalks / 4) as LineValue;
  if (![6, 7, 8, 9].includes(lineValue)) {
    throw new Error(`YARROW_INVALID_VALUE: ${lineValue} from ${stalks}`);
  }

  return { lineIndex, lineValue, changes, algorithmVersion: ALGORITHM_VERSIONS.yarrow_stalk };
}
