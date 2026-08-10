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

function remainderOf(count: number): 1 | 2 | 3 | 4 {
  const remainder = count % 4;
  return (remainder === 0 ? 4 : remainder) as 1 | 2 | 3 | 4;
}

function removedCountForSplit(startingStalks: number, leftGroup: number): number {
  const rightGroup = startingStalks - leftGroup;
  return 1 + remainderOf(leftGroup) + remainderOf(rightGroup - 1);
}

function targetRemoved(changeIndex: 0 | 1 | 2, randomInt: RandomInt): 4 | 5 | 8 | 9 {
  if (changeIndex === 0) return randomInt(4) === 0 ? 9 : 5;
  return randomInt(2) === 0 ? 8 : 4;
}

function validSplits(startingStalks: number, target: number): number[] {
  const candidates: number[] = [];
  for (let leftGroup = 1; leftGroup < startingStalks; leftGroup += 1) {
    if (removedCountForSplit(startingStalks, leftGroup) === target) candidates.push(leftGroup);
  }
  return candidates;
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

  const target = targetRemoved(changeIndex, randomInt);
  const candidates = validSplits(startingStalks, target);
  if (candidates.length === 0) throw new Error("YARROW_NO_VALID_SPLIT");

  const leftGroup = candidates[randomInt(candidates.length)];
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

export function cryptoRandomInt(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) throw new Error("RANDOM_INVALID_RANGE");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomInt } = require("node:crypto");
  return randomInt(0, maxExclusive);
}
